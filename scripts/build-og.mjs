// Generates a text-only Open Graph image (1200x630 PNG) for every built page.
// Runs after `astro build`: reads each page's og:title, description and breadcrumb
// section from dist/, and writes dist/og/<path>.png, which BaseHead points at.
// No game art is used, only the site's own colours and two open-licence fonts.
import { readFileSync, writeFileSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { createRequire } from 'node:module';
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';

const require = createRequire(import.meta.url);
const font = (pkg, file) => readFileSync(require.resolve(`@fontsource/${pkg}/files/${file}`));
const fonts = [
  { name: 'Display', data: font('eb-garamond', 'eb-garamond-latin-700-normal.woff'), weight: 700 },
  { name: 'Sans', data: font('inter', 'inter-latin-400-normal.woff'), weight: 400 },
  { name: 'Sans', data: font('inter', 'inter-latin-600-normal.woff'), weight: 600 },
];

const DIST = 'dist';
const decode = (s) =>
  s.replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n)).replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');
const meta = (html, attr, name) => {
  const m = html.match(new RegExp(`<meta ${attr}="${name}" content="([^"]*)"`));
  return m ? decode(m[1]) : '';
};

function* htmlFiles(dir) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) {
      if (!['og', '_astro', 'pagefind', 'data'].includes(name)) yield* htmlFiles(p);
    } else if (name.endsWith('.html')) yield p;
  }
}

const h = (type, style, children) => ({ type, props: { style, children } });

function card({ title, description, section, site }) {
  return h('div', { width: 1200, height: 630, display: 'flex', flexDirection: 'column', justifyContent: 'space-between', padding: '64px 72px', background: '#121010', color: '#f3eee6', fontFamily: 'Sans', borderTop: '12px solid #e0b05a' }, [
    h('div', { display: 'flex', flexDirection: 'column', width: 1056 }, [
      h('div', { display: 'flex', fontSize: 28, fontWeight: 600, color: '#e0b05a', textTransform: 'uppercase', letterSpacing: 3 }, section || 'Path of Exile 2 guide'),
      h('div', { display: 'flex', marginTop: 24, fontFamily: 'Display', fontSize: title.length > 48 ? 64 : 80, lineHeight: 1.08 }, title),
      h('div', { display: 'flex', marginTop: 28, fontSize: 30, lineHeight: 1.4, color: '#b9b0a3' }, description),
    ]),
    h('div', { display: 'flex', position: 'absolute', left: 72, bottom: 56, width: 1056, justifyContent: 'space-between', alignItems: 'flex-end', fontSize: 28 }, [
      h('div', { display: 'flex', fontFamily: 'Display', fontSize: 40, color: '#f2c879' }, site),
      h('div', { display: 'flex', color: '#8f877b' }, 'A beginner guide to Path of Exile 2'),
    ]),
  ]);
}

let count = 0;
for (const file of htmlFiles(DIST)) {
  const html = readFileSync(file, 'utf8');
  const title = meta(html, 'property', 'og:title');
  if (!title) continue;
  const description = meta(html, 'property', 'og:description');
  const site = meta(html, 'property', 'og:site_name');
  // Section = second breadcrumb (e.g. "Builds"), when the page has one.
  const crumbs = [...html.matchAll(/"@type":"ListItem","position":(\d+),"name":"([^"]*)"/g)];
  const section = crumbs.length > 2 ? decode(crumbs[1][2]) : '';

  const rel = relative(DIST, file).replace(/\\/g, '/').replace(/(^|\/)index\.html$/, '').replace(/\.html$/, '');
  const out = join(DIST, 'og', `${rel || 'index'}.png`);
  // The home page's og:title is just "Home"; show the site name instead.
  const svg = await satori(card({ title: rel ? title : site, description, section, site }), { width: 1200, height: 630, fonts });
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, new Resvg(svg).render().asPng());
  count++;
}
console.log(`OG images: ${count} written to ${DIST}/og/`);
