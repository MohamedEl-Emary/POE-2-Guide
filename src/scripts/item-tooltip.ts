/**
 * Game-style item tooltips for any element with `data-item="<key>"`
 * (keys are item names, or "u:<name>" for uniques). One shared tooltip element
 * is filled from /data/item-tooltips.json, which is fetched on first use.
 *
 * Mouse: hover. Keyboard: focus. Touch: tap to open, tap elsewhere to close.
 */

interface Tooltip {
  r: 'unique' | 'normal' | 'currency' | 'gem';
  n: string;
  b?: string;
  c?: string;
  p?: [string | null, string][];
  q?: string;
  i?: string[];
  m?: string[];
  d?: string[];
  g?: [string, string][];
  f?: string[];
  x?: boolean;
}

let data: Promise<Record<string, Tooltip>> | null = null;
const load = () =>
  (data ??= fetch('/data/item-tooltips.json')
    .then((r) => r.json())
    .catch(() => {
      data = null;
      return {};
    }));

const box = document.createElement('div');
box.id = 'item-tooltip';
box.setAttribute('role', 'tooltip');
box.hidden = true;
document.body.append(box);

let current: HTMLElement | null = null;

function el(tag: string, className: string, text?: string) {
  const node = document.createElement(tag);
  node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function render(t: Tooltip) {
  box.className = `itt itt-${t.r}`;
  box.replaceChildren();
  const head = el('div', 'itt-head');
  head.append(el('div', 'itt-name', t.n));
  if (t.b) head.append(el('div', 'itt-name', t.b));
  box.append(head);

  const sections: HTMLElement[] = [];
  const section = () => {
    const s = el('div', 'itt-section');
    sections.push(s);
    return s;
  };

  if (t.c || t.p?.length) {
    const s = section();
    if (t.c) s.append(el('div', 'itt-class', t.c));
    for (const [label, value] of t.p ?? []) {
      const line = el('div', 'itt-prop');
      if (label) {
        line.append(el('span', 'itt-label', `${label}: `), el('span', 'itt-value', value));
      } else line.append(el('span', 'itt-value', value));
      s.append(line);
    }
  }
  if (t.q) {
    const line = el('div', 'itt-prop');
    line.append(el('span', 'itt-label', 'Requires: '), el('span', 'itt-value', t.q));
    section().append(line);
  }
  if (t.i?.length) {
    const s = section();
    for (const m of t.i) s.append(el('div', 'itt-mod', m));
  }
  if (t.d?.length) {
    const s = section();
    for (const d of t.d) s.append(el('div', 'itt-mod itt-desc', d));
  }
  if (t.g?.length) {
    const s = section();
    for (const [slots, text] of t.g) {
      const line = el('div', 'itt-mod itt-left');
      line.append(el('span', 'itt-slot', `${slots}: `), document.createTextNode(text.replaceAll('\n', ' / ')));
      s.append(line);
    }
  }
  if (t.m?.length || t.x) {
    const s = section();
    for (const m of t.m ?? []) s.append(el('div', 'itt-mod', m));
    if (t.x) s.append(el('div', 'itt-corrupted', 'Corrupted'));
  }
  if (t.f?.length) {
    const s = section();
    for (const f of t.f) s.append(el('div', 'itt-flavour', f));
  }
  for (const s of sections) box.append(s);
}

function place(target: HTMLElement) {
  const r = target.getBoundingClientRect();
  const gap = 8;
  box.style.left = '0px';
  box.style.top = '0px';
  const w = box.offsetWidth;
  const h = box.offsetHeight;
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(gap, Math.min(left, vw - w - gap));
  // Prefer above the item, like the game; flip below when there's no room.
  let top = r.top - h - gap;
  if (top < gap) top = r.bottom + gap;
  if (top + h > vh - gap) top = Math.max(gap, vh - h - gap);
  box.style.left = `${left + window.scrollX}px`;
  box.style.top = `${top + window.scrollY}px`;
}

async function show(target: HTMLElement) {
  const key = target.dataset.item;
  if (!key) return;
  current = target;
  const all = await load();
  if (current !== target) return;
  const t = all[key];
  if (!t) return;
  render(t);
  box.hidden = false;
  place(target);
  target.setAttribute('aria-describedby', 'item-tooltip');
}

function hide() {
  current?.removeAttribute('aria-describedby');
  current = null;
  box.hidden = true;
}

// A tap focuses the trigger before its click; let the click decide so the tap doesn't open and close at once.
let lastPointerDown = 0;
document.addEventListener('pointerdown', () => (lastPointerDown = Date.now()), true);

const triggerOf = (e: Event) => (e.target as Element | null)?.closest?.<HTMLElement>('[data-item]') ?? null;

document.addEventListener('pointerover', (e) => {
  if (e.pointerType === 'touch') return;
  const t = triggerOf(e);
  if (t && t !== current) show(t);
});
document.addEventListener('pointerout', (e) => {
  if (e.pointerType === 'touch') return;
  const t = triggerOf(e);
  if (t && t === current && !t.contains(e.relatedTarget as Node)) hide();
});
document.addEventListener('focusin', (e) => {
  const t = triggerOf(e);
  if (t && Date.now() - lastPointerDown > 500) show(t);
});
document.addEventListener('focusout', (e) => {
  if (triggerOf(e) === current) hide();
});
document.addEventListener('click', (e) => {
  const t = triggerOf(e);
  if (!t) {
    if (current) hide();
    return;
  }
  // Taps toggle; on desktop a click on a trigger just keeps it open.
  if ((e as PointerEvent).pointerType === 'touch' || (e as PointerEvent).pointerType === 'pen') {
    if (t === current && !box.hidden) hide();
    else show(t);
  }
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') hide();
});
window.addEventListener('scroll', () => current && !box.hidden && place(current), { passive: true });
