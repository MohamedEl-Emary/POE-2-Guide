import data from '../data/item-icons.json';

/** An item's official icon on GGG's CDN, its inventory size in cells, and its category. */
export interface ItemIconData {
  i: string;
  w: number;
  h: number;
  c: string;
  /** Base type, uniques only. */
  b?: string;
}

const items = data.items as Record<string, ItemIconData>;
const uniques = data.uniques as Record<string, ItemIconData>;

/** Looks up a base item or currency (or a unique, with `unique`) by its exact in-game name. */
export function getItemIcon(name: string, unique = false): ItemIconData {
  const found = (unique ? uniques : items)[name];
  if (!found) throw new Error(`No ${unique ? 'unique' : 'item'} called "${name}" in src/data/item-icons.json`);
  return found;
}

export function itemsInCategory(category: string): [string, ItemIconData][] {
  return Object.entries(items).filter(([, v]) => v.c === category);
}

export function allUniques(): [string, ItemIconData][] {
  return Object.entries(uniques).sort(([a], [b]) => a.localeCompare(b));
}

export const STATS_CREDIT =
  'Item stats are game data © Grinding Gear Games, via Path of Building. Currency and omen descriptions are our own wording.';

export const ICON_CREDIT =
  'Item images are © Grinding Gear Games and load directly from their servers. They are not stored on this site.';

export type Rarity = 'unique' | 'currency' | 'gem' | 'normal';

/** The key an item's tooltip is stored under in public/data/item-tooltips.json. */
export const tooltipKey = (name: string, unique = false) => (unique ? `u:${name}` : name);

const CURRENCY_CATEGORIES = new Set(['Currency', 'Omen', 'SoulCore']);

/** Rarity colour for an item's name, matching the game's tooltips. */
export function rarityOf(name: string, unique = false): Rarity {
  if (unique) return 'unique';
  const c = getItemIcon(name).c;
  if (CURRENCY_CATEGORIES.has(c)) return 'currency';
  if (c === 'UncutSkillGem' || c.endsWith('Gem')) return 'gem';
  return 'normal';
}
