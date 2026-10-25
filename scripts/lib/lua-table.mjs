// A small reader for the Lua table literals in Path of Building's data files.
// It understands strings, long strings, numbers, booleans and nested tables,
// which is all those generated files use. Not a general Lua parser.

/**
 * Parses the table literal starting at `src[start]` (which must be "{").
 * A table with only positional entries becomes an array. A table with keys
 * becomes an object, with any positional entries under `_list`.
 */
export function parseTableAt(src, start) {
  let i = start;

  const skip = () => {
    for (;;) {
      while (i < src.length && /\s/.test(src[i])) i++;
      if (src.startsWith('--', i)) {
        const long = src.slice(i + 2).match(/^\[(=*)\[/);
        if (long) {
          const close = `]${long[1]}]`;
          i = src.indexOf(close, i) + close.length;
        } else {
          while (i < src.length && src[i] !== '\n') i++;
        }
        continue;
      }
      return;
    }
  };

  const longString = () => {
    const m = src.slice(i).match(/^\[(=*)\[/);
    const close = `]${m[1]}]`;
    const from = i + m[0].length;
    const to = src.indexOf(close, from);
    i = to + close.length;
    // Lua drops a newline straight after the opening bracket.
    return src.slice(from, to).replace(/^\r?\n/, '');
  };

  const quoted = () => {
    const q = src[i++];
    let out = '';
    while (src[i] !== q) {
      if (src[i] === '\\') {
        const c = src[++i];
        out += { n: '\n', t: '\t', r: '\r', '\\': '\\', '"': '"', "'": "'" }[c] ?? c;
      } else out += src[i];
      i++;
    }
    i++;
    return out;
  };

  const value = () => {
    skip();
    const c = src[i];
    if (c === '{') return table();
    if (c === '"' || c === "'") return quoted();
    if (c === '[' && /^\[=*\[/.test(src.slice(i))) return longString();
    const word = src.slice(i).match(/^-?(?:0x[0-9a-f]+|\d*\.?\d+(?:e[-+]?\d+)?)|^[A-Za-z_]\w*/i)[0];
    i += word.length;
    if (word === 'true') return true;
    if (word === 'false') return false;
    if (word === 'nil') return null;
    return Number(word);
  };

  const table = () => {
    i++; // {
    const list = [];
    const map = {};
    let keyed = false;
    for (;;) {
      skip();
      if (src[i] === '}') {
        i++;
        break;
      }
      let key;
      if (src[i] === '[' && !/^\[=*\[/.test(src.slice(i))) {
        i++;
        key = value();
        skip();
        i++; // ]
        skip();
        i++; // =
      } else {
        const m = src.slice(i).match(/^([A-Za-z_]\w*)\s*=(?!=)/);
        if (m) {
          key = m[1];
          i += m[0].length;
        }
      }
      const v = value();
      if (key === undefined) list.push(v);
      else {
        map[key] = v;
        keyed = true;
      }
      skip();
      if (src[i] === ',' || src[i] === ';') i++;
    }
    if (!keyed) return list;
    if (list.length) map._list = list;
    return map;
  };

  return { value: table(), end: i };
}

/** Parses a whole `return { ... }` file. */
export function parseReturnTable(src) {
  return parseTableAt(src, src.indexOf('{', src.indexOf('return'))).value;
}
