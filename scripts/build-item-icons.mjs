// Builds src/data/item-icons.json: item name -> official icon URL on GGG's CDN
// (web.poecdn.com), plus inventory size and category. Only URLs are stored;
// the images themselves are loaded from GGG's servers by the visitor's browser.
//
// The name -> URL mapping comes from Exiled Exchange 2 (MIT licence), a PoE2
// price-check tool whose item data is built from GGG's official trade data.
//
// Usage: node scripts/build-item-icons.mjs [path-or-url-to-items.ndjson]

import { mkdir, readFile, writeFile } from 'node:fs/promises';

const SOURCE_REF = '3f7b233c255f759f7066eee1e482ac8c8826844b'; // Exiled Exchange 2 v0.9.4
const DEFAULT_SOURCE = `https://raw.githubusercontent.com/Kvan7/Exiled-Exchange-2/${SOURCE_REF}/renderer/public/data/en/items.ndjson`;
const OUT = new URL('../src/data/item-icons.json', import.meta.url);

const source = process.argv[2] ?? DEFAULT_SOURCE;
const raw = source.startsWith('http') ? await (await fetch(source)).text() : await readFile(source, 'utf8');
const rows = raw.split('\n').filter(Boolean).map((line) => JSON.parse(line));

const usable = (r) =>
  r.name && !r.name.startsWith('[DNT]') && r.name !== 'INCOMPLETE' && r.icon?.startsWith('https://web.poecdn.com/');

/** The CDN URL embeds the game's art path, e.g. "2DItems/Armours/Boots/Uniques/AbAeterno". */
function artPath(url) {
  const segment = url.split('/gen/image/')[1]?.split('/')[0] ?? '';
  try {
    return JSON.parse(Buffer.from(segment, 'base64url').toString())[2].f ?? '';
  } catch {
    return '';
  }
}

// Unique groups for the gallery filter, matched against the art path in order.
const UNIQUE_GROUPS = [
  ['Weapons', /^2DItems\/Weapons\//],
  ['Body armour', /^2DItems\/Armours\/BodyArmours\//],
  ['Helmets', /^2DItems\/Armours\/Helmets\//],
  ['Gloves', /^2DItems\/Armours\/Gloves\//],
  ['Boots', /^2DItems\/Armours\/Boots\//],
  ['Off-hands', /^2DItems\/(Offhand|Quivers)\//],
  ['Rings', /^2DItems\/Rings\//],
  ['Amulets', /^2DItems\/Amulets\//],
  ['Belts', /^2DItems\/Belts\//],
  ['Flasks and charms', /^2DItems\/(Flasks|Charms)\//],
  ['Jewels', /^2DItems\/Jewels\//],
];

const items = {};
for (const r of rows) {
  if (!usable(r) || r.namespace === 'UNIQUE' || items[r.name]) continue;
  items[r.name] = { i: r.icon, w: r.w, h: r.h, c: r.craftable?.category ?? r.namespace.toLowerCase() };
}

// Uniques share names across base variants (e.g. a "Runemastered" base); keep one entry each.
const uniques = {};
for (const r of rows) {
  if (!usable(r) || r.namespace !== 'UNIQUE' || uniques[r.name]) continue;
  const path = artPath(r.icon);
  const group = UNIQUE_GROUPS.find(([, re]) => re.test(path))?.[0] ?? 'Tablets and relics';
  uniques[r.name] = { i: r.icon, w: r.w, h: r.h, c: group, b: r.unique.base };
}

await mkdir(new URL('.', OUT), { recursive: true });
await writeFile(OUT, JSON.stringify({ source: SOURCE_REF, items, uniques }));
console.log(`item-icons.json: ${Object.keys(items).length} items, ${Object.keys(uniques).length} uniques`);
