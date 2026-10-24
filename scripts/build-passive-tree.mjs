// Converts Grinding Gear Games' official passive tree export into the compact
// file the /passive-tree/ page loads. Only text and coordinates are kept: the
// export's icon paths point at GGG artwork, which this site doesn't use.
//
// Usage: node scripts/build-passive-tree.mjs [path-or-url-to-data.json]
// Default source is GGG's export repo at the tag in TREE_VERSION.

import { mkdir, readFile, writeFile } from 'node:fs/promises';

const TREE_VERSION = '0.5.2';
const DEFAULT_SOURCE = 'https://raw.githubusercontent.com/grindinggear/poe2-skilltree-export/master/data.json';
const OUT = new URL('../public/data/passive-tree.json', import.meta.url);

// PoE2 classes share the six PoE1 start positions; classStartIndex lists the
// `classes` indexes that start on each one. PoE1-only classes are dropped.
const POE2_CLASSES = new Set(['Warrior', 'Sorceress', 'Witch', 'Ranger', 'Huntress', 'Mercenary', 'Monk', 'Druid', 'Duelist']);

const source = process.argv[2] ?? DEFAULT_SOURCE;
const raw = source.startsWith('http')
  ? await (await fetch(source)).text()
  : await readFile(source, 'utf8');
const data = JSON.parse(raw);

/** "[Energy|Energy]" -> "Energy", "[Strength]" -> "Strength", drops <tags>{...}. */
function cleanStat(text) {
  return text
    .replace(/\[([^\]|]+)\|([^\]]+)\]/g, '$2')
    .replace(/\[([^\]]+)\]/g, '$1')
    .replace(/<[^>]+>\{([^}]*)\}/g, '$1');
}

function kindOf(n) {
  if (n.classStartIndex) return 'start';
  if (n.isKeystone) return 'keystone';
  if (n.isJewelSocket) return 'jewel';
  if (n.isMastery) return 'mastery';
  if (n.isNotable) return 'notable';
  if (n.isGenericAttribute) return 'attribute';
  return 'small';
}

const ids = new Map();
const nodes = [];
for (const [key, n] of Object.entries(data.nodes)) {
  if (key === 'root' || n.ascendancyId || n.x === undefined) continue;
  // Masteries are background art in the export, not allocatable nodes.
  if (n.isMastery) continue;
  ids.set(key, nodes.length);
  const node = {
    x: Math.round(n.x),
    y: Math.round(n.y),
    k: kindOf(n),
    n: n.isGenericAttribute ? 'Attribute' : n.name,
    s: n.isGenericAttribute ? ['+5 to Strength, Dexterity or Intelligence (you choose)'] : n.stats.map(cleanStat),
  };
  if (n.classStartIndex) {
    node.c = n.classStartIndex.map((i) => data.classes[i]?.name).filter((c) => POE2_CLASSES.has(c));
    node.n = `${node.c.join(' / ')} start`;
  }
  if (n.flavourText?.length) node.f = n.flavourText.join(' ');
  nodes.push(node);
}

// Edges: [from, to] or [from, to, centerX, centerY] when the link is an arc
// around its group's center, which is how the in-game tree draws same-orbit links.
const seen = new Set();
const edges = [];
for (const e of data.edges) {
  const a = ids.get(String(e.from));
  const b = ids.get(String(e.to));
  if (a === undefined || b === undefined) continue;
  const key = a < b ? `${a}-${b}` : `${b}-${a}`;
  if (seen.has(key)) continue;
  seen.add(key);
  edges.push(e.orbitX !== undefined ? [a, b, Math.round(e.orbitX), Math.round(e.orbitY)] : [a, b]);
}

const out = {
  version: TREE_VERSION,
  source: 'https://github.com/grindinggear/poe2-skilltree-export',
  nodes,
  edges,
};

await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, JSON.stringify(out));
console.log(`passive-tree.json: ${nodes.length} nodes, ${edges.length} edges (tree ${TREE_VERSION})`);
