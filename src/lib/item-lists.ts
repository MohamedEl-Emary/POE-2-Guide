// The complete item list pages under /items/<slug>/: which items each one
// shows, how they're grouped into filter chips, and the line under each name.
import type { Entry } from '../components/ItemDatabase.astro';
import gemInfo from '../data/gem-info.json';
import tooltipData from '../../public/data/item-tooltips.json';
import { itemsInCategory } from './items';

interface TooltipLite {
  p?: [string | null, string][];
  q?: string;
}
const tooltips = tooltipData as unknown as Record<string, TooltipLite>;
const gems = gemInfo as Record<string, { k: string; a: string; t?: string }>;

export interface ItemList {
  slug: string;
  title: string;
  /** Meta description. */
  description: string;
  intro: string;
  noun: string;
  searchHint: string;
  groups: string[];
  entries: () => Entry[];
}

const byName = (a: Entry, b: Entry) => a.name.localeCompare(b.name);
const levelOf = (name: string) => Number(tooltips[name]?.q?.match(/Level (\d+)/)?.[1] ?? 1);

const DEFENCES: [string, string][] = [
  ['Armour', 'Armour'],
  ['Evasion Rating', 'Evasion'],
  ['Energy Shield', 'Energy Shield'],
];

/** "Level 59 · Evasion, Energy Shield" for armour, "Level 33" for everything else. */
function baseLine(name: string): string {
  const props = tooltips[name]?.p ?? [];
  const defences = DEFENCES.filter(([label]) => props.some(([l]) => l === label)).map(([, short]) => short);
  return [`Level ${levelOf(name)}`, defences.join(', ')].filter(Boolean).join(' · ');
}

/** Every base in `categories`, grouped under the chip label for its category, lowest level first. */
function bases(categories: Record<string, string>): Entry[] {
  return Object.entries(categories)
    .flatMap(([category, group]) => itemsInCategory(category).map(([name]) => ({ name, group, sub: baseLine(name) })))
    .sort((a, b) => levelOf(a.name) - levelOf(b.name) || byName(a, b));
}

/** Every gem in `categories`, grouped by its kind (src/data/gem-info.json); kinds not in `groups` become "Other". */
function gemEntries(categories: string[], groups: string[]): Entry[] {
  return categories
    .flatMap((c) => itemsInCategory(c).map(([name]) => name))
    .map((name) => {
      const info = gems[name];
      const kind = info?.k ?? 'Other';
      return { name, group: groups.includes(kind) ? kind : 'Other', sub: info?.t };
    })
    .sort(byName);
}

const WEAPONS: Record<string, string> = {
  'One Hand Mace': 'One-handed maces', 'Two Hand Mace': 'Two-handed maces', Warstaff: 'Quarterstaves', Spear: 'Spears',
  'One Hand Sword': 'One-handed swords', 'Two Hand Sword': 'Two-handed swords', 'One Hand Axe': 'One-handed axes',
  'Two Hand Axe': 'Two-handed axes', Dagger: 'Daggers', Flail: 'Flails', Bow: 'Bows', Crossbow: 'Crossbows',
  Wand: 'Wands', Staff: 'Staves', Sceptre: 'Sceptres', Talisman: 'Talismans',
};
const ARMOUR: Record<string, string> = {
  Helmet: 'Helmets', 'Body Armour': 'Body armour', Gloves: 'Gloves', Boots: 'Boots', Shield: 'Shields',
  Buckler: 'Bucklers', Focus: 'Foci', Quiver: 'Quivers',
};
const JEWELLERY: Record<string, string> = { Ring: 'Rings', Amulet: 'Amulets', Belt: 'Belts' };
const FLASKS: Record<string, string> = { Flask: 'Flasks', Charm: 'Charms', Jewel: 'Jewels' };
const ENDGAME: Record<string, string> = {
  Map: 'Waystones', TowerAugment: 'Precursor tablets', MapFragment: 'Fragments', PinnacleKey: 'Pinnacle keys',
  Breachstone: 'Fragments', VaultKey: 'Reliquary keys', MiscMapItem: 'Trial keys', ExpeditionLogbook: 'Other',
  Relic: 'Relics', BrequelFruit: 'Other', Incubator: 'Other', UncutSkillGem: 'Uncut gems',
};

export const ITEM_LISTS: ItemList[] = [
  {
    slug: 'skill-gems',
    title: 'Skill gems',
    description: 'Every Path of Exile 2 skill gem with its icon and in-game stats: attacks, spells, minions, warcries and more.',
    intro: 'Every active skill gem in the game. Spirit and meta gems have their own page. Hover, tap or tab to a gem to see its cost, tags and level 1 stats.',
    noun: 'skill gem',
    searchHint: 'Name or tag, e.g. fire, projectile',
    groups: ['Attack', 'Spell', 'Minion', 'Warcry', 'Other'],
    entries: () => gemEntries(['Active Skill Gem'], ['Attack', 'Spell', 'Minion', 'Warcry', 'Spirit']).filter((e) => e.group !== 'Spirit'),
  },
  {
    slug: 'spirit-gems',
    title: 'Spirit and meta gems',
    description: 'Every Path of Exile 2 spirit gem (persistent buffs, auras and heralds) and meta gem (Cast on Critical and friends), with stats.',
    intro: 'Spirit gems are skills that stay active and reserve Spirit, like heralds and auras. Meta gems hold other skills and trigger them for you.',
    noun: 'gem',
    searchHint: 'Name or tag, e.g. herald, trigger',
    groups: ['Spirit', 'Meta'],
    entries: () =>
      [
        ...gemEntries(['Active Skill Gem'], ['Spirit']).filter((e) => e.group === 'Spirit'),
        ...gemEntries(['MetaSkillGem'], []).map((e) => ({ ...e, group: 'Meta' })),
      ].sort(byName),
  },
  {
    slug: 'support-gems',
    title: 'Support gems',
    description: 'Every Path of Exile 2 support gem with its icon and effect, filterable by attribute.',
    intro: 'Every support gem in the game. Each one changes the skill it is socketed into, and you can only use each support once across all your skills.',
    noun: 'support gem',
    searchHint: 'Name or tag, e.g. projectile, minion',
    groups: ['Strength', 'Dexterity', 'Intelligence', 'Other'],
    entries: () => gemEntries(['Support Skill Gem'], ['Strength', 'Dexterity', 'Intelligence']),
  },
  {
    slug: 'weapons',
    title: 'Weapon bases',
    description: 'Every Path of Exile 2 weapon base type, from maces and spears to wands and talismans, with damage and requirements.',
    intro: 'Every weapon base type in the game, lowest level first. Hover one to see its damage, speed and requirements.',
    noun: 'weapon',
    searchHint: 'Name',
    groups: Object.values(WEAPONS),
    entries: () => bases(WEAPONS),
  },
  {
    slug: 'armour',
    title: 'Armour bases',
    description: 'Every Path of Exile 2 armour base type: helmets, body armour, gloves, boots, shields, bucklers, foci and quivers.',
    intro: 'Every armour base type in the game, lowest level first. The line under each name shows which defences it has.',
    noun: 'armour base',
    searchHint: 'Name or defence, e.g. evasion',
    groups: Object.values(ARMOUR),
    entries: () => bases(ARMOUR),
  },
  {
    slug: 'jewellery',
    title: 'Rings, amulets and belts',
    description: 'Every Path of Exile 2 ring, amulet and belt base type with its implicit modifier.',
    intro: 'Every jewellery base type in the game. Hover one to see its implicit modifier.',
    noun: 'item',
    searchHint: 'Name',
    groups: Object.values(JEWELLERY),
    entries: () => bases(JEWELLERY),
  },
  {
    slug: 'flasks-charms-jewels',
    title: 'Flasks, charms and jewels',
    description: 'Every Path of Exile 2 flask, charm and jewel base type with its stats.',
    intro: 'Every flask, charm and jewel base in the game.',
    noun: 'item',
    searchHint: 'Name',
    groups: Object.values(FLASKS),
    entries: () => bases(FLASKS),
  },
  {
    slug: 'endgame',
    title: 'Endgame items',
    description: 'Every Path of Exile 2 waystone, precursor tablet, fragment, pinnacle key, reliquary key, trial key, relic and uncut gem.',
    intro: 'Everything that opens or changes endgame content: waystones, tablets, boss fragments and keys, trial keys and relics, plus uncut gems.',
    noun: 'item',
    searchHint: 'Name',
    groups: ['Waystones', 'Precursor tablets', 'Fragments', 'Pinnacle keys', 'Reliquary keys', 'Trial keys', 'Relics', 'Uncut gems', 'Other'],
    entries: () =>
      Object.entries(ENDGAME).flatMap(([category, group]) =>
        itemsInCategory(category).map(([name]) => ({ name, group })),
      ),
  },
];
