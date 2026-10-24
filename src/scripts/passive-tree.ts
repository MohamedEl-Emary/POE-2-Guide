/**
 * Interactive passive tree, drawn on a canvas from /data/passive-tree.json
 * (built by scripts/build-passive-tree.mjs from GGG's official export).
 * Node shapes and colours are our own; no game artwork is used.
 *
 * Mouse: drag to pan, wheel to zoom, click to allocate or remove a node.
 * Touch: drag to pan, pinch to zoom, tap to select, then use the panel button.
 */

type Kind = 'small' | 'attribute' | 'notable' | 'keystone' | 'jewel' | 'start';
interface TreeNode {
  x: number;
  y: number;
  k: Kind;
  n: string;
  s: string[];
  c?: string[];
  f?: string;
}
type Edge = [number, number] | [number, number, number, number];
interface TreeData {
  version: string;
  nodes: TreeNode[];
  edges: Edge[];
}

const KIND_LABEL: Record<Kind, string> = {
  small: 'Small passive',
  attribute: 'Attribute passive',
  notable: 'Notable passive',
  keystone: 'Keystone',
  jewel: 'Jewel socket',
  start: 'Class start',
};
// Radius in tree units, and the smallest on-screen radius in CSS pixels.
const RADIUS: Record<Kind, [number, number]> = {
  small: [32, 0.9],
  attribute: [32, 0.9],
  notable: [58, 1.8],
  keystone: [90, 3.5],
  jewel: [60, 2],
  start: [110, 5],
};

export async function initPassiveTree(root: HTMLElement) {
  const canvas = root.querySelector<HTMLCanvasElement>('canvas')!;
  const ctx = canvas.getContext('2d')!;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const classSelect = $<HTMLSelectElement>('[data-class]');
  const searchInput = $<HTMLInputElement>('[data-search]');
  const searchCount = $('[data-search-count]');
  const pointsOut = $('[data-points]');
  const panel = $('[data-panel]');
  const status = $('[data-status]');

  let data: TreeData;
  try {
    const res = await fetch('/data/passive-tree.json');
    data = await res.json();
  } catch {
    status.textContent = 'The passive tree failed to load. Please refresh the page.';
    return;
  }
  status.hidden = true;
  const { nodes, edges } = data;

  const adj: number[][] = nodes.map(() => []);
  for (const [a, b] of edges) {
    adj[a].push(b);
    adj[b].push(a);
  }
  const starts = nodes.flatMap((n, i) => (n.k === 'start' ? [i] : []));
  const classes = [...new Set(starts.flatMap((i) => nodes[i].c ?? []))].sort();
  for (const c of classes) classSelect.add(new Option(c, c));

  // ---- State -------------------------------------------------------------
  let className = classes[0];
  let startNode = starts[0];
  const allocated = new Set<number>();
  let hovered = -1;
  let selected = -1;
  let matches = new Set<number>();
  let matchList: number[] = [];
  let matchCursor = -1;

  const view = { x: 0, y: 0, scale: 1 };
  let width = 0;
  let height = 0;

  function css(name: string) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }
  let palette = readPalette();
  function readPalette() {
    return {
      bg: css('--bg'),
      line: css('--border'),
      node: css('--muted'),
      attr: css('--surface-2'),
      accent: css('--accent'),
      strong: css('--accent-strong'),
      fg: css('--fg'),
      match: css('--info-fg'),
    };
  }
  new MutationObserver(() => {
    palette = readPalette();
    draw();
  }).observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });

  // ---- Allocation --------------------------------------------------------
  function setClass(name: string) {
    className = name;
    classSelect.value = name;
    startNode = starts.find((i) => nodes[i].c?.includes(name)) ?? starts[0];
    allocated.clear();
    allocated.add(startNode);
  }

  /** Shortest path from the allocated set to `target`, not crossing other class starts. */
  function pathTo(target: number): number[] {
    const prev = new Map<number, number>();
    const queue = [...allocated];
    for (const i of queue) prev.set(i, -1);
    for (let q = 0; q < queue.length; q++) {
      const cur = queue[q];
      if (cur === target) break;
      for (const nb of adj[cur]) {
        if (prev.has(nb) || (nodes[nb].k === 'start' && nb !== startNode)) continue;
        prev.set(nb, cur);
        queue.push(nb);
      }
    }
    if (!prev.has(target)) return [];
    const path: number[] = [];
    for (let i = target; i !== -1 && !allocated.has(i); i = prev.get(i)!) path.push(i);
    return path;
  }

  /** Drops allocated nodes that are no longer connected to the class start. */
  function prune() {
    const keep = new Set([startNode]);
    const queue = [startNode];
    for (let q = 0; q < queue.length; q++) {
      for (const nb of adj[queue[q]]) {
        if (allocated.has(nb) && !keep.has(nb)) {
          keep.add(nb);
          queue.push(nb);
        }
      }
    }
    for (const i of [...allocated]) if (!keep.has(i)) allocated.delete(i);
  }

  function toggle(node: number) {
    if (node === startNode || nodes[node].k === 'start') return;
    if (allocated.has(node)) {
      allocated.delete(node);
      prune();
    }
    else for (const i of pathTo(node)) allocated.add(i);
    afterChange();
  }

  function afterChange() {
    const points = allocated.size - 1;
    pointsOut.textContent = String(points);
    writeHash();
    renderPanel();
    draw();
  }

  // ---- Share link --------------------------------------------------------
  function writeHash() {
    const ids = [...allocated].filter((i) => i !== startNode).sort((a, b) => a - b);
    const hash = `#v=${data.version}&c=${encodeURIComponent(className)}${ids.length ? `&n=${ids.join('.')}` : ''}`;
    history.replaceState(null, '', hash);
  }
  function readHash() {
    const params = new URLSearchParams(location.hash.slice(1));
    const c = params.get('c');
    setClass(c && classes.includes(c) ? c : classes[0]);
    // Node numbers are only stable within one tree version.
    if (params.get('v') !== data.version) return;
    const ids = (params.get('n') ?? '').split('.').map(Number).filter((i) => Number.isInteger(i) && nodes[i] && nodes[i].k !== 'start');
    for (const i of ids) allocated.add(i);
    // Drop anything the link claims that isn't actually connected.
    prune();
  }

  // ---- Panel -------------------------------------------------------------
  function renderPanel() {
    const i = selected >= 0 ? selected : hovered;
    panel.replaceChildren();
    if (i < 0) {
      const p = document.createElement('p');
      p.className = 'text-muted';
      p.textContent = 'Hover or tap a node to read what it does.';
      panel.append(p);
      return;
    }
    const n = nodes[i];
    const kind = document.createElement('p');
    kind.className = 'text-xs font-semibold uppercase tracking-wide text-accent';
    kind.textContent = KIND_LABEL[n.k];
    const title = document.createElement('h2');
    title.className = 'mt-1 text-lg font-bold';
    title.textContent = n.n || KIND_LABEL[n.k];
    panel.append(kind, title);
    if (n.s.length) {
      const ul = document.createElement('ul');
      ul.className = 'mt-2 space-y-1 text-sm';
      for (const line of n.s.flatMap((s) => s.split('\n'))) {
        const li = document.createElement('li');
        li.textContent = line;
        ul.append(li);
      }
      panel.append(ul);
    }
    if (n.f) {
      const f = document.createElement('p');
      f.className = 'mt-2 text-sm italic text-muted';
      f.textContent = n.f;
      panel.append(f);
    }
    if (n.k !== 'start') {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mt-3 rounded-md border border-border bg-surface-2 px-3 py-1.5 text-sm font-semibold hover:border-accent';
      const cost = allocated.has(i) ? 0 : pathTo(i).length;
      btn.textContent = allocated.has(i) ? 'Remove' : cost ? `Allocate (${cost} point${cost === 1 ? '' : 's'})` : 'Not reachable';
      btn.disabled = !allocated.has(i) && !cost;
      btn.addEventListener('click', () => toggle(i));
      panel.append(btn);
    }
  }

  // ---- Search ------------------------------------------------------------
  function runSearch() {
    const q = searchInput.value.trim().toLowerCase();
    matchList = q.length < 2 ? [] : nodes.flatMap((n, i) => (n.n.toLowerCase().includes(q) || n.s.some((s) => s.toLowerCase().includes(q)) ? [i] : []));
    // Bigger nodes first, so "next match" visits notables and keystones before small passives.
    const order: Kind[] = ['keystone', 'notable', 'jewel', 'small', 'attribute', 'start'];
    matchList.sort((a, b) => order.indexOf(nodes[a].k) - order.indexOf(nodes[b].k));
    matches = new Set(matchList);
    matchCursor = -1;
    searchCount.textContent = q.length < 2 ? '' : `${matchList.length} match${matchList.length === 1 ? '' : 'es'}`;
    draw();
  }
  function nextMatch() {
    if (!matchList.length) return;
    matchCursor = (matchCursor + 1) % matchList.length;
    selected = matchList[matchCursor];
    centerOn(selected, Math.max(view.scale, 0.25));
    renderPanel();
  }

  // ---- View --------------------------------------------------------------
  function fit() {
    const xs = nodes.map((n) => n.x);
    const ys = nodes.map((n) => n.y);
    const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
    view.scale = Math.min(width / (x1 - x0), height / (y1 - y0)) * 0.95;
    view.x = width / 2 - ((x0 + x1) / 2) * view.scale;
    view.y = height / 2 - ((y0 + y1) / 2) * view.scale;
    draw();
  }
  function centerOn(i: number, scale = view.scale) {
    view.scale = scale;
    view.x = width / 2 - nodes[i].x * scale;
    view.y = height / 2 - nodes[i].y * scale;
    draw();
  }
  function zoomAt(factor: number, sx: number, sy: number) {
    const next = Math.min(1.5, Math.max(0.01, view.scale * factor));
    const f = next / view.scale;
    view.x = sx - (sx - view.x) * f;
    view.y = sy - (sy - view.y) * f;
    view.scale = next;
    draw();
  }
  function resize() {
    const rect = canvas.getBoundingClientRect();
    const first = width === 0;
    width = rect.width;
    height = rect.height;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    if (first) fit();
    else draw();
  }

  // ---- Drawing -----------------------------------------------------------
  let frame = 0;
  function draw() {
    if (!frame) frame = requestAnimationFrame(paint);
  }
  function radiusOf(n: TreeNode) {
    const [r, min] = RADIUS[n.k];
    return Math.max(r * view.scale, min);
  }
  function paint() {
    frame = 0;
    const { x: ox, y: oy, scale } = view;
    ctx.fillStyle = palette.bg;
    ctx.fillRect(0, 0, width, height);
    ctx.lineCap = 'round';

    // Two passes so allocated links sit on top of the rest.
    for (const pass of [0, 1]) {
      ctx.beginPath();
      for (const e of edges) {
        const on = allocated.has(e[0]) && allocated.has(e[1]);
        if (on !== (pass === 1)) continue;
        const a = nodes[e[0]];
        const b = nodes[e[1]];
        const ax = ox + a.x * scale;
        const ay = oy + a.y * scale;
        if (e.length === 4) {
          const cx = ox + e[2] * scale;
          const cy = oy + e[3] * scale;
          const r = Math.hypot(ax - cx, ay - cy);
          const t1 = Math.atan2(ay - cy, ax - cx);
          const t2 = Math.atan2(oy + b.y * scale - cy, ox + b.x * scale - cx);
          let d = t2 - t1;
          if (d > Math.PI) d -= 2 * Math.PI;
          if (d < -Math.PI) d += 2 * Math.PI;
          ctx.moveTo(ax, ay);
          ctx.arc(cx, cy, r, t1, t2, d < 0);
        } else {
          ctx.moveTo(ax, ay);
          ctx.lineTo(ox + b.x * scale, oy + b.y * scale);
        }
      }
      ctx.strokeStyle = pass ? palette.accent : palette.line;
      ctx.lineWidth = Math.max((pass ? 14 : 9) * scale, pass ? 1.6 : 0.8);
      ctx.stroke();
    }

    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const x = ox + n.x * scale;
      const y = oy + n.y * scale;
      const r = radiusOf(n);
      if (x < -r || y < -r || x > width + r || y > height + r) continue;
      const on = allocated.has(i);
      ctx.beginPath();
      if (n.k === 'keystone' || n.k === 'jewel') {
        // Diamond for keystones and sockets.
        ctx.moveTo(x, y - r);
        ctx.lineTo(x + r, y);
        ctx.lineTo(x, y + r);
        ctx.lineTo(x - r, y);
        ctx.closePath();
      } else {
        ctx.arc(x, y, r, 0, Math.PI * 2);
      }
      if (n.k === 'start') {
        ctx.fillStyle = palette.bg;
        ctx.fill();
        ctx.lineWidth = Math.max(r * 0.25, 2);
        ctx.strokeStyle = i === startNode ? palette.strong : palette.line;
        ctx.stroke();
      } else {
        ctx.fillStyle = on ? palette.strong : n.k === 'attribute' ? palette.attr : n.k === 'jewel' ? palette.bg : palette.node;
        ctx.fill();
        if (n.k !== 'small' || on) {
          ctx.lineWidth = Math.max(r * 0.18, 1);
          ctx.strokeStyle = on ? palette.accent : n.k === 'attribute' ? palette.node : palette.line;
          ctx.stroke();
        }
      }
      if (matches.has(i) || i === hovered || i === selected) {
        ctx.beginPath();
        ctx.arc(x, y, r + Math.max(4, r * 0.4), 0, Math.PI * 2);
        ctx.lineWidth = 2;
        ctx.strokeStyle = i === selected || i === hovered ? palette.fg : palette.match;
        ctx.stroke();
      }
    }

    // Labels once zoomed in far enough to read them.
    if (scale > 0.12) {
      ctx.fillStyle = palette.fg;
      ctx.textAlign = 'center';
      ctx.font = '600 12px system-ui, sans-serif';
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i];
        if (n.k !== 'notable' && n.k !== 'keystone' && n.k !== 'start') continue;
        const x = ox + n.x * scale;
        const y = oy + n.y * scale + radiusOf(n) + 14;
        if (x < -100 || y < 0 || x > width + 100 || y > height + 20) continue;
        ctx.fillText(n.n, x, y);
      }
    }
  }

  function nodeAt(sx: number, sy: number) {
    let best = -1;
    let bestD = Infinity;
    for (let i = 0; i < nodes.length; i++) {
      const n = nodes[i];
      const d = Math.hypot(view.x + n.x * view.scale - sx, view.y + n.y * view.scale - sy);
      if (d < Math.max(radiusOf(n), 8) && d < bestD) {
        best = i;
        bestD = d;
      }
    }
    return best;
  }

  // ---- Input -------------------------------------------------------------
  const pointers = new Map<number, { x: number; y: number }>();
  let downAt: { x: number; y: number } | null = null;
  let moved = false;
  let pinchDist = 0;
  const local = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  canvas.addEventListener('pointerdown', (e) => {
    canvas.setPointerCapture(e.pointerId);
    const p = local(e);
    pointers.set(e.pointerId, p);
    if (pointers.size === 1) {
      downAt = p;
      moved = false;
    } else if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      pinchDist = Math.hypot(a.x - b.x, a.y - b.y);
      moved = true;
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    const p = local(e);
    const prev = pointers.get(e.pointerId);
    if (!prev) {
      // Hover only applies to a mouse that isn't dragging.
      if (e.pointerType === 'mouse') {
        const h = nodeAt(p.x, p.y);
        if (h !== hovered) {
          hovered = h;
          canvas.style.cursor = h >= 0 ? 'pointer' : 'grab';
          renderPanel();
          draw();
        }
      }
      return;
    }
    pointers.set(e.pointerId, p);
    if (pointers.size === 2) {
      const [a, b] = [...pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchDist) zoomAt(dist / pinchDist, (a.x + b.x) / 2, (a.y + b.y) / 2);
      pinchDist = dist;
      return;
    }
    if (downAt && Math.hypot(p.x - downAt.x, p.y - downAt.y) > 5) moved = true;
    if (moved) {
      view.x += p.x - prev.x;
      view.y += p.y - prev.y;
      canvas.style.cursor = 'grabbing';
      draw();
    }
  });
  const end = (e: PointerEvent) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    if (pointers.size > 0) return;
    canvas.style.cursor = 'grab';
    if (!moved && e.type === 'pointerup') {
      const p = local(e);
      const i = nodeAt(p.x, p.y);
      if (e.pointerType === 'mouse') {
        if (i >= 0) toggle(i);
      } else {
        selected = i;
        renderPanel();
        draw();
      }
    }
    downAt = null;
    pinchDist = 0;
  };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('pointerleave', () => {
    if (hovered >= 0 && pointers.size === 0) {
      hovered = -1;
      renderPanel();
      draw();
    }
  });
  canvas.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const p = local(e as unknown as PointerEvent);
      zoomAt(Math.exp(-e.deltaY * 0.0015), p.x, p.y);
    },
    { passive: false },
  );

  root.querySelector('[data-zoom-in]')!.addEventListener('click', () => zoomAt(1.5, width / 2, height / 2));
  root.querySelector('[data-zoom-out]')!.addEventListener('click', () => zoomAt(1 / 1.5, width / 2, height / 2));
  root.querySelector('[data-fit]')!.addEventListener('click', fit);
  root.querySelector('[data-reset]')!.addEventListener('click', () => {
    setClass(className);
    selected = -1;
    afterChange();
  });
  root.querySelector('[data-next]')!.addEventListener('click', nextMatch);
  searchInput.addEventListener('input', runSearch);
  searchInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      nextMatch();
    }
  });
  classSelect.addEventListener('change', () => {
    setClass(classSelect.value);
    selected = -1;
    afterChange();
    centerOn(startNode, Math.max(view.scale, 0.05));
  });

  new ResizeObserver(resize).observe(canvas);
  readHash();
  resize();
  // A shared tree opens zoomed in on its class start rather than the whole map.
  if (allocated.size > 1) centerOn(startNode, 0.06);
  afterChange();
}
