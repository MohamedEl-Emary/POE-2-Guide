// Turns Path of Building stat ids and values into the lines the game shows,
// using the stat description files in src/Data/StatDescriptions.

import { readFile } from 'node:fs/promises';
import { parseReturnTable } from './lua-table.mjs';

const round = (n, dp) => Number(n.toFixed(dp));

const HANDLERS = {
  negate: (x) => -x,
  negate_and_double: (x) => -2 * x,
  double: (x) => 2 * x,
  times_twenty: (x) => 20 * x,
  divide_by_two_0dp: (x) => Math.round(x / 2),
  divide_by_five: (x) => x / 5,
  divide_by_ten_0dp: (x) => Math.round(x / 10),
  divide_by_ten_1dp: (x) => round(x / 10, 1),
  divide_by_ten_1dp_if_required: (x) => round(x / 10, 1),
  divide_by_one_hundred: (x) => x / 100,
  divide_by_one_hundred_2dp_if_required: (x) => round(x / 100, 2),
  divide_by_one_hundred_and_negate: (x) => -x / 100,
  milliseconds_to_seconds: (x) => x / 1000,
  milliseconds_to_seconds_0dp: (x) => Math.round(x / 1000),
  milliseconds_to_seconds_1dp: (x) => round(x / 1000, 1),
  milliseconds_to_seconds_2dp: (x) => round(x / 1000, 2),
  milliseconds_to_seconds_2dp_if_required: (x) => round(x / 1000, 2),
  per_minute_to_per_second: (x) => x / 60,
  per_minute_to_per_second_0dp: (x) => Math.round(x / 60),
  per_minute_to_per_second_1dp: (x) => round(x / 60, 1),
  per_minute_to_per_second_2dp: (x) => round(x / 60, 2),
  per_minute_to_per_second_2dp_if_required: (x) => round(x / 60, 2),
};

const format = (n) => String(round(n, 2));

const inLimit = (value, [min, max]) =>
  (typeof min !== 'number' || value >= min) && (typeof max !== 'number' || value <= max);

/** Loads stat description scopes on demand and translates stats through their parent chain. */
export function statTranslator(descriptionsDir) {
  const scopes = new Map();

  // Scopes are either top-level files or skill-specific ones, named with or without their folder.
  async function scope(name) {
    if (!scopes.has(name)) {
      const file = name.replace(/^specific_skill_stat_descriptions\//i, '');
      const load = (path) => readFile(`${descriptionsDir}/${path}.lua`, 'utf8').then(parseReturnTable);
      scopes.set(
        name,
        load(file)
          .catch(() => load(`Specific_Skill_Stat_Descriptions/${file}`))
          .catch(() => null),
      );
    }
    return scopes.get(name);
  }

  /** Finds the description block for `stat`, starting at scope `name` and walking up to its parents. */
  async function find(name, stat) {
    for (let current = name; current; ) {
      const table = await scope(current);
      if (!table) {
        current = current === 'skill_stat_descriptions' ? null : 'skill_stat_descriptions';
        continue;
      }
      if (table[stat] !== undefined) return table[table[stat]];
      current = table.parent;
    }
    return null;
  }

  /**
   * Translates `stats` ({id: value}) to display lines, in the order the stats were given.
   * Stats with no description, or hidden ones, are left out.
   */
  return async function translate(scopeName, stats) {
    const lines = [];
    const done = new Set();
    for (const id of Object.keys(stats)) {
      if (done.has(id)) continue;
      const block = await find(scopeName, id);
      if (!block) continue;
      const ids = Object.values(block.stats ?? {});
      for (const s of ids) done.add(s);
      const values = ids.map((s) => stats[s] ?? 0);
      if (values.every((v) => v === 0)) continue;
      const variants = Object.values(block[1] ?? {}).filter((v) => typeof v === 'object');
      const variant = variants.find((v) => Object.values(v.limit ?? {}).every((lim, i) => inLimit(values[i], Object.values(lim))));
      if (!variant?.text) continue;
      const shown = [...values];
      for (const h of Object.values(variant).filter((x) => typeof x === 'object' && x.k)) {
        const fn = HANDLERS[h.k];
        if (fn && typeof h.v === 'number') shown[h.v - 1] = fn(shown[h.v - 1]);
      }
      const text = variant.text.replace(/\{(\d+)(?::([+-]?)d)?\}/g, (_, i, sign) => {
        const v = shown[Number(i)] ?? 0;
        return (sign === '+' && v >= 0 ? '+' : '') + format(v);
      });
      lines.push(...text.split('\n'));
    }
    return lines;
  };
}
