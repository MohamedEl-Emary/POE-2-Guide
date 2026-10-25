// Builds public/data/item-tooltips.json, the data behind the game-style item
// tooltips. Stats are game data (c) Grinding Gear Games, read from Path of
// Building's data files (MIT): unique mods, base item stats, flavour text,
// essence and rune effects. Currency, omen and catalyst descriptions are our
// own words, from src/data/item-descriptions.json.
//
// Usage:
//   git clone --depth 1 https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2 /tmp/pob
//   node scripts/build-item-tooltips.mjs /tmp/pob/src/Data
//
// Run scripts/build-item-icons.mjs first: only items with an icon get a tooltip.

import { readFile, readdir, writeFile } from 'node:fs/promises';
import { parseReturnTable, parseTableAt } from './lib/lua-table.mjs';

const dataDir = process.argv[2];
if (!dataDir) throw new Error('Pass the path to Path of Building PoE2 src/Data');
const OUT = new URL('../public/data/item-tooltips.json', import.meta.url);
const read = (path) => readFile(`${dataDir}/${path}`, 'utf8');
const json = async (url) => JSON.parse(await readFile(new URL(url, import.meta.url), 'utf8'));

const icons = await json('../src/data/item-icons.json');
const words = await json('../src/data/item-descriptions.json');

const tooltips = {};

// ---- Base items --------------------------------------------------------

const CLASS_NAMES = {
  Amulet: 'Amulets', Belt: 'Belts', 'Body Armour': 'Body Armours', Boots: 'Boots', Bow: 'Bows', Charm: 'Charms',
  Claw: 'Claws', Crossbow: 'Crossbows', Dagger: 'Daggers', Flail: 'Flails', Focus: 'Foci', Gloves: 'Gloves',
  Helmet: 'Helmets', Jewel: 'Jewels', 'One Hand Axe': 'One Hand Axes', 'One Hand Mace': 'One Hand Maces',
  'One Hand Sword': 'One Hand Swords', Quiver: 'Quivers', Ring: 'Rings', Sceptre: 'Sceptres', Shield: 'Shields',
  Spear: 'Spears', Staff: 'Staves', Talisman: 'Talismans', 'Two Hand Axe': 'Two Hand Axes',
  'Two Hand Mace': 'Two Hand Maces', 'Two Hand Sword': 'Two Hand Swords', Wand: 'Wands',
};

function className(base) {
  if (base.type === 'Staff' && base.subType === 'Warstaff') return 'Quarterstaves';
  if (base.type === 'Shield' && base.tags?.buckler) return 'Bucklers';
  if (base.type === 'Flask') return `${base.subType} Flasks`;
  return CLASS_NAMES[base.type] ?? base.type;
}

const fixed = (n, digits = 2) => n.toFixed(digits);

/** Property lines shown under the item class, like "Armour: 89". */
function baseProperties(base) {
  const props = [];
  const a = base.armour;
  if (a) {
    if (a.BlockChance) props.push(['Block chance', `${a.BlockChance}%`]);
    if (a.Armour) props.push(['Armour', String(a.Armour)]);
    if (a.Evasion) props.push(['Evasion Rating', String(a.Evasion)]);
    if (a.EnergyShield) props.push(['Energy Shield', String(a.EnergyShield)]);
  }
  const w = base.weapon;
  if (w) {
    if (w.PhysicalMax) props.push(['Physical Damage', `${w.PhysicalMin}-${w.PhysicalMax}`]);
    props.push(['Critical Hit Chance', `${fixed(w.CritChanceBase)}%`]);
    props.push(['Attacks per Second', fixed(w.AttackRateBase)]);
    if (w.ReloadTimeBase) props.push(['Reload Time', fixed(w.ReloadTimeBase)]);
  }
  if (base.spirit) props.push(['Spirit', String(base.spirit)]);
  const f = base.flask;
  if (f) {
    const what = f.life ? `${f.life} Life` : `${f.mana} Mana`;
    props.push([null, `Recovers ${what} over ${f.duration} Seconds`]);
    props.push([null, `Consumes ${f.chargesUsed} of ${f.chargesMax} Charges on use`]);
  }
  const c = base.charm;
  if (c) {
    props.push([null, `Lasts ${c.duration} Seconds`]);
    props.push([null, `Consumes ${c.chargesUsed} of ${c.chargesMax} Charges on use`]);
  }
  return props;
}

function requirements(req = {}, levelOverride) {
  const parts = [];
  const level = levelOverride ?? req.level;
  if (level > 1) parts.push(`Level ${level}`);
  if (req.str) parts.push(`${req.str} Str`);
  if (req.dex) parts.push(`${req.dex} Dex`);
  if (req.int) parts.push(`${req.int} Int`);
  return parts.length ? parts.join(', ') : undefined;
}

const bases = {};
for (const file of await readdir(`${dataDir}/Bases`)) {
  const src = await read(`Bases/${file}`);
  for (const m of src.matchAll(/itemBases\["((?:[^"\\]|\\.)*)"\]\s*=\s*\{/g)) {
    bases[m[1]] = parseTableAt(src, m.index + m[0].length - 1).value;
  }
}

for (const [name, base] of Object.entries(bases)) {
  if (!icons.items[name] || base.hidden) continue;
  const entry = { r: 'normal', n: name, c: className(base) };
  const props = baseProperties(base);
  if (props.length) entry.p = props;
  const req = requirements(base.req);
  if (req) entry.q = req;
  if (base.implicit) entry.i = base.implicit.split('\n');
  if (base.charm?.buff) entry.m = base.charm.buff;
  if (base.type === 'Jewel') entry.d = [words.jewel];
  tooltips[name] = entry;
}

// ---- Uniques -----------------------------------------------------------

const flavour = {};
for (const f of parseReturnTable(await read('FlavourText.lua'))) flavour[f.name] ??= f.text;

const HEADER = /^(Source|League|Variant|Selected Variant|Selected Alt Variant[\w ]*|Has Alt Variant[\w ]*|Version|Sockets|LevelReq|Implicits|Allow Duplicate Variants|Crafted|Left ring slot|Right ring slot):/;

function parseUnique(text) {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const [name, baseName] = lines;
  let variants = 0;
  let selected;
  let implicitCount = 0;
  let levelReq;
  const props = [];
  const body = [];
  for (const line of lines.slice(2)) {
    if (line.startsWith('Variant:')) variants++;
    else if (line.startsWith('Selected Variant:')) selected = Number(line.split(':')[1]);
    else if (line.startsWith('Implicits:')) implicitCount = Number(line.split(':')[1]);
    else if (/^Requires Level \d+/.test(line)) levelReq = Number(line.match(/\d+/)[0]);
    else if (/^(Limited to|Radius):/.test(line)) props.push([line.split(':')[0], line.split(':')[1].trim()]);
    else if (!HEADER.test(line)) body.push(line);
  }
  const variant = selected ?? variants;
  const keep = (line) => {
    const v = line.match(/\{variant:([\d,]+)\}/);
    return !v || !variant || v[1].split(',').map(Number).includes(variant);
  };
  const clean = (line) => line.replace(/\{[^}]*\}/g, '').trim();
  const implicits = body.slice(0, implicitCount).filter(keep).map(clean);
  const mods = body.slice(implicitCount).filter(keep).map(clean).filter(Boolean);
  return { name, baseName, props, levelReq, implicits, mods };
}

for (const file of await readdir(`${dataDir}/Uniques`)) {
  if (!file.endsWith('.lua')) continue;
  for (const text of parseReturnTable(await read(`Uniques/${file}`))) {
    const u = parseUnique(text);
    if (!icons.uniques[u.name] || tooltips[`u:${u.name}`]) continue;
    const base = bases[u.baseName];
    const corrupted = u.mods.includes('Corrupted');
    const entry = { r: 'unique', n: u.name, b: u.baseName };
    if (base) entry.c = className(base);
    const props = [...(base ? baseProperties(base) : []), ...u.props];
    if (props.length) entry.p = props;
    const req = requirements(base?.req, u.levelReq);
    if (req) entry.q = req;
    if (u.implicits.length) entry.i = u.implicits;
    entry.m = u.mods.filter((m) => m !== 'Corrupted');
    if (flavour[u.name]) entry.f = flavour[u.name];
    if (corrupted) entry.x = true;
    tooltips[`u:${u.name}`] = entry;
  }
}

// Uniques Path of Building doesn't cover yet (mostly tablets and relics) still get a name card.
for (const [name, u] of Object.entries(icons.uniques)) {
  tooltips[`u:${name}`] ??= { r: 'unique', n: name, b: u.b, d: ['Full stats for this unique are on poe2db.'] };
}

// ---- Essences ----------------------------------------------------------

const mods = { ...parseReturnTable(await read('ModItemExclusive.lua')), ...parseReturnTable(await read('ModItem.lua')) };
const modText = (id) => mods[id]?._list?.join('\n');

/** Groups slots that share the same text: [["Helmet, Body Armour", "+(30-39) to maximum Life"], ...] */
function groupBySlot(slotText) {
  const groups = new Map();
  for (const [slot, text] of slotText) {
    if (!text) continue;
    groups.set(text, [...(groups.get(text) ?? []), slot]);
  }
  return [...groups].map(([text, slots]) => [slots.join(', '), text]);
}

for (const essence of Object.values(parseReturnTable(await read('Essence.lua')))) {
  if (!icons.items[essence.name]) continue;
  const perfect = essence.name.startsWith('Perfect ');
  tooltips[essence.name] = {
    r: 'currency',
    n: essence.name,
    d: [perfect ? words.perfectEssence : words.essence],
    g: groupBySlot(Object.entries(essence.mods).map(([slot, id]) => [slot, modText(id)])),
  };
}

// ---- Runes and soul cores ------------------------------------------------

const RUNE_SLOTS = { weapon: 'Martial Weapons', caster: 'Caster Weapons', armour: 'Armour', 'body armour': 'Body Armour' };
const slotLabel = (slot) => RUNE_SLOTS[slot] ?? slot.replace(/\b\w/g, (c) => c.toUpperCase());

for (const [name, slots] of Object.entries(parseReturnTable(await read('ModRunes.lua')))) {
  if (!icons.items[name]) continue;
  tooltips[name] = {
    r: 'currency',
    n: name,
    d: [words.rune],
    g: groupBySlot(Object.entries(slots).map(([slot, mod]) => [slotLabel(slot), mod._list?.join('\n')])),
  };
}

// ---- Currency, omens, catalysts and other items ----------------------------

const currencyLike = (name, lines) => {
  if (!tooltips[name] && icons.items[name]) tooltips[name] = { r: 'currency', n: name, d: lines };
};

for (const [name, text] of Object.entries(words.currency)) currencyLike(name, [text]);

for (const [name, item] of Object.entries(icons.items)) {
  if (item.c === 'Omen') currencyLike(name, words.omens[name] ? [words.omens[name], words.omenGeneric] : [words.omenGeneric]);
  const catalyst = name.match(/^(Refined )?(.+) Catalyst$/);
  if (catalyst && words.catalystTypes[catalyst[2]]) {
    const target = catalyst[1] ? 'a jewel' : 'a ring or amulet';
    currencyLike(name, [`Adds quality to ${target} that boosts its ${words.catalystTypes[catalyst[2]]} modifiers`]);
  }
  if (item.c === 'Map') {
    const tier = name.match(/Tier (\d+)/)?.[1];
    tooltips[name] = { r: 'normal', n: name, c: 'Waystones', p: tier ? [['Waystone Tier', tier]] : undefined, d: [words.waystone] };
  }
  if (item.c === 'TowerAugment') tooltips[name] = { r: 'normal', n: name, c: 'Precursor Tablets', d: [words.tablet] };
  if (item.c === 'UncutSkillGem') {
    const kind = name.replace(/ \(Level \d+\)$/, '');
    const level = name.match(/Level (\d+)/)?.[1];
    if (words.uncut[kind]) tooltips[name] = { r: 'gem', n: name, p: level ? [['Level', level]] : undefined, d: [words.uncut[kind]] };
  }
}

// Every other item with an icon still gets a name card, so no icon on the site is a dead trigger.
const RARITY = { Currency: 'currency', Omen: 'currency', SoulCore: 'currency', UncutSkillGem: 'gem' };
for (const [name, item] of Object.entries(icons.items)) {
  tooltips[name] ??= { r: RARITY[item.c] ?? 'normal', n: name };
}

await writeFile(OUT, JSON.stringify(tooltips));
const count = (r) => Object.values(tooltips).filter((t) => t.r === r).length;
console.log(
  `item-tooltips.json: ${Object.keys(tooltips).length} tooltips (${count('unique')} uniques, ${count('normal')} bases, ${count('currency')} currency-type, ${count('gem')} gems)`,
);
