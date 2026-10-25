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

export const ICON_CREDIT =
  'Item images are © Grinding Gear Games and load directly from their servers. They are not stored on this site.';
