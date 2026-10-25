# Exile Mentor: a beginner guide to Path of Exile 2

Static guide site built with Astro, Tailwind CSS, MDX and Pagefind. No server, no database: all content is Markdown/MDX in `src/content/`.


## Requirements

- Node.js **22.23.4 or newer** (Astro 7 requirement; `.nvmrc` pins 24)
- pnpm (npm works too)

## Commands

| Command | What it does |
|---|---|
| `pnpm install` | Install dependencies |
| `pnpm dev` | Local dev server at http://localhost:4321 (search is not available in dev) |
| `pnpm build` | Type/schema check, build to `dist/`, then build the Pagefind search index |
| `pnpm preview` | Serve the built `dist/` locally, search included |

Set `SITE_URL` (e.g. `https://example.com`) in your host's build environment so canonical URLs, the sitemap and `robots.txt` use the real domain.

## Deploying

The site is fully static, so any static host works. We recommend **Cloudflare Pages** (free, fast, reads `public/_headers` for caching). Netlify and Vercel work the same way.

1. Push this repo to GitHub (done).
2. In Cloudflare: Workers & Pages → Create → Pages → Connect to Git → pick `POE-2-Guide`.
3. Settings:
   - Build command: `pnpm build`
   - Output directory: `dist`
   - Environment variables: `NODE_VERSION` = `24`, `PNPM_VERSION` = `11`, and `SITE_URL` = your real address (e.g. `https://exilementor.com`).
4. Deploy. Every push to `main` redeploys; pull requests get preview links.
5. Add your custom domain under the project's Custom domains tab, then update `SITE_URL` to match and redeploy.
6. Submit `https://<your-domain>/sitemap-index.xml` in [Google Search Console](https://search.google.com/search-console) so Google indexes the site before 1.0.

`.github/workflows/build.yml` runs the same build on every pull request, so a broken page shows up as a failed check before it's merged.

Each page gets a generated 1200x630 share image (`scripts/build-og.mjs`, run by `pnpm build`): text only, made from the page title, description and section.

## Project layout

```
src/
  config.ts            CURRENT_PATCH, site name, navigation (NAV)
  content.config.ts    Collections + Zod schemas (build fails on bad frontmatter)
  content/
    classes/           One file per class (file name = URL slug)
    ascendancies/      One file per Ascendancy; `class` must match a class file
    builds/            One file per build guide (file name = URL slug)
    guides/            Guide pages; the folder path becomes the URL
    glossary/          One file per term
    patches/           One file per game patch
  lib/patch.ts         Patch-freshness logic
  lib/content.ts       Draft filtering, guide URLs, "which routes exist"
  components/          PatchBadge, PatchBanner, Callout, GlossaryTerm, TableOfContents,
                       Breadcrumbs, ClassCard, AscendancyCard, BuildCard, RatingBars, GemSetup,
                       ProgressChecklist, Header, Footer...
  layouts/             BaseLayout (SEO head, header, footer), GuideLayout (banner + ToC)
  pages/               index, start-here/, about, glossary/, search/, patches/, 404, robots.txt,
                       classes/ (index + [class]), ascendancies/[ascendancy],
                       builds/ (index with filters, tier-list, [build]),
                       [...slug].astro (renders every entry in content/guides)
```

## Adding a guide

Create `src/content/guides/<section>/<slug>.mdx`. The file path is the URL:
`guides/start-here/faq.mdx` → `/start-here/faq/`, `guides/campaign/index.mdx` → `/campaign/`.

```yaml
---
title: Loot filters explained
description: 140-160 characters. The build fails if it's shorter or longer, because this becomes the meta description in search results.
patch: "0.5.5"            # game version this was written for
lastVerified: 2026-10-24  # when someone last checked it against the game
status: current           # current | needs-review | outdated
difficulty: beginner      # beginner | intermediate | advanced
tags: [loot]
section: start-here       # start-here | campaign | endgame | farming | crafting | reference
order: 4                  # reading order inside the section
featured: false           # show on the home page
draft: false              # true = visible in `pnpm dev` only
---
```

Components available in every guide without importing:

```mdx
<Callout type="tip">...</Callout>            {/* tip | warning | beginner, optional title="..." */}
<GlossaryTerm id="divine-orb" />             {/* uses the term's name */}
<GlossaryTerm id="skill-gem">skill gems</GlossaryTerm>
<Item name="Divine Orb" />  <ItemIcon name="Headhunter" unique />   {/* game icon + tooltip */}
<GemSetup gems={[...]} />  <ProgressChecklist id="..." groups={[...]} />
```

A `GlossaryTerm` pointing at a missing glossary entry fails the build.

Navigation links in `src/config.ts` that don't have a page yet show a "Soon" label instead of a broken link. They become real links automatically once the page exists.

## Classes and Ascendancies

Each class lists its Ascendancies in `ascendancies:` and each Ascendancy points back with `class:`. The build fails if the two disagree, so a missing or misspelled Ascendancy can't slip through. Ascendancy `keyNodes` are shown as "Signature mechanics"; keep them as summaries in our own words.

For the Duelist at 1.0: fill in `attributes`, `beginnerFriendly` and `ascendancies`, remove `availableFrom`, and add one file per new Ascendancy.

## Adding a build

Create `src/content/builds/<slug>.mdx`. It appears at `/builds/<slug>/`, in the filterable `/builds/` list, on the tier list, and on its class and Ascendancy pages.

```yaml
---
title: Ice Shot Deadeye
description: 140-160 characters.
patch: "0.5.5"
lastVerified: 2026-10-25
status: current
difficulty: beginner
class: ranger                # file name in content/classes/
ascendancy: deadeye          # file name in content/ascendancies/ (must belong to `class`)
mainSkill: Ice Shot
budget: starter              # starter | low | medium | high
leagueStarter: true
ssfFriendly: true
playstyle: ranged            # melee | ranged | caster | minion (used by the filter)
tier: S                      # S | A | B | C, our opinion, shown on the tier list
ratings: { clear: 4, singleTarget: 4, defense: 3, easeOfPlay: 5 }   # 1-5
leveling: true               # the guide includes a leveling section
farms: [breach, expedition]  # file names in content/guides/farming/
pobLink: https://pobb.in/... # optional
---
```

The build fails if the Ascendancy doesn't belong to the class or a `farms` entry has no farming guide. Write the body with the 12 headings used in the existing builds (Summary, Pros and cons, How the build works, Leveling, Ascendancy order, Passive tree, Gems, Gear, Defenses, Playstyle, Atlas and farming pairing, Common mistakes). Gem tables use:

```mdx
<GemSetup gems={[
  { skill: 'Ice Shot', supports: ['Elemental Armament II', 'Fork'], note: 'Main skill' },
]} />
```

Gem names found in the item data get an icon and tooltip; unknown names (such as Lineage supports) show as plain text. To retire a build, set `status: outdated`: it stays online with a red banner but leaves the tier list.

## Farming strategies

Farming strategy pages live in `src/content/guides/farming/` with `section: farming`, and follow the 8 headings in the existing pages (Summary, Why it makes money, Requirements, Setup, In-map execution, What to pick up and sell, Budget vs full version, Risks). Never write exchange rates or exact profits; link poe.ninja.

## Interactive checklist

`<ProgressChecklist id="..." groups={[...]} />` (see `guides/endgame/progression-checklist.mdx`) saves ticks in the visitor's browser. Change its `id` when the content changes a lot (for example at 1.0) so old ticks don't carry over.

## Updating the passive tree

`/passive-tree/` draws the tree from `public/data/passive-tree.json`, which is generated from Grinding Gear Games' official [passive tree export](https://github.com/grindinggear/poe2-skilltree-export). When GGG publishes a new tree, set `TREE_VERSION` in `scripts/build-passive-tree.mjs` and run `node scripts/build-passive-tree.mjs` (or pass a local `data.json` path). Only node names, stats and positions are kept. The export's icon paths are dropped because they point at GGG artwork. Shared tree links include the version, so links made on an older tree open with an empty plan instead of the wrong nodes.

## Item icons

`<ItemIcon name="..." />` (and `unique` for uniques) shows an item's official icon, loaded from GGG's CDN. It can be used in any MDX file without importing it. Names must match the game exactly; a typo fails the build. The name → URL list lives in `src/data/item-icons.json` and is regenerated with `node scripts/build-item-icons.mjs`, which reads the item data from [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2) (MIT). Bump `SOURCE_REF` in that script to a newer release after a big patch.

## Item list pages

`/items/<slug>/` pages (skill, spirit and support gems, weapons, armour, jewellery, flasks/charms/jewels, endgame items) list every item of a kind with search and filter chips. They are defined in `src/lib/item-lists.ts` and rendered by `src/components/ItemDatabase.astro`; add a list there and it gets a page and a card on the item gallery. Gem filters come from `src/data/gem-info.json`, which `scripts/build-item-tooltips.mjs` writes.

## Item tooltips

Any element with `data-item="<name>"` (or `data-item="u:<name>"` for a unique) shows a game-style tooltip on hover, keyboard focus or tap. `<ItemIcon>` tiles do this automatically, and `<Item name="Divine Orb" />` adds an inline mention with icon and tooltip to any MDX guide. The script is `src/scripts/item-tooltip.ts`, loaded on every page; it fetches `public/data/item-tooltips.json` the first time someone opens a tooltip.

That file is generated. Unique mods, base stats, flavour text, essence, rune and liquid emotion effects, and skill gem stats (translated through PoB's stat description files by `scripts/lib/stat-text.mjs`) are game data read from [Path of Building PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2)'s data files (last built from commit `bb52d6b`). Currency, omen, catalyst and league item descriptions (Abyss bones, splinters, Expedition artifacts and so on) are our own wording in `src/data/item-descriptions.json`; edit that file to add or fix one. To rebuild after a patch:

```sh
git clone --depth 1 https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2 /tmp/pob
node scripts/build-item-icons.mjs
node scripts/build-item-tooltips.mjs /tmp/pob/src/Data
```

## How the patch banner works

`CURRENT_PATCH` in `src/config.ts` is the single source of truth. Every page compares its own `patch` and `status`:

| Page frontmatter | Shows |
|---|---|
| `patch` ≥ `CURRENT_PATCH` and `status: current` | Green "Up to date for 0.5.5" badge |
| `patch` older than `CURRENT_PATCH`, or `status: needs-review` | Yellow "Written for patch X, may be outdated" banner |
| `status: outdated` | Red banner; page stays up but is removed from featured/recommended lists |

## Running the 1.0 update

1. In `src/config.ts`, set `CURRENT_PATCH = '1.0'`. Every page written for 0.5.x now shows the yellow banner.
2. In `src/content/patches/1-0.md`, set `upcoming: false`.
3. Regenerate the passive tree (see above) once GGG publishes the 1.0 export.
4. Re-verify pages one by one. When a page is accurate for 1.0, set `patch: "1.0"` and update `lastVerified`. Mark pages you know are wrong `status: outdated`.
5. Add the Duelist and its Ascendancies, and rewrite the campaign section (`guides/campaign/`) for six Acts.
6. Re-check every build, the tier list and the farming pages. Builds that no longer work: `status: outdated`.
7. Give the progression checklist a new `id` (e.g. `endgame-1.0`) and update its steps.

Evergreen pages flag too. That's intentional: they become green again once someone has checked them.

## Content rules

- Original words only. Summarise and link; never copy from wikis, patch notes or other guides.
- No Grinding Gear Games art, logos or class portraits stored in the repo. Item icons are the one exception to using their art: they're hotlinked from GGG's CDN (`<ItemIcon name="Divine Orb" />`), never downloaded or committed. Mohamed approved this in October 2026.
- Never state exchange rates or exact profits as fact. Give ranges and link to poe.ninja.
