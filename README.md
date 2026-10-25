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

Deploy: any static host. Build command `pnpm build`, output directory `dist`.

## Project layout

```
src/
  config.ts            CURRENT_PATCH, site name, navigation (NAV)
  content.config.ts    Collections + Zod schemas (build fails on bad frontmatter)
  content/
    classes/           One file per class (file name = URL slug)
    ascendancies/      One file per Ascendancy; `class` must match a class file
    builds/            (Phase 3)
    guides/            Guide pages; the folder path becomes the URL
    glossary/          One file per term
    patches/           One file per game patch
  lib/patch.ts         Patch-freshness logic
  lib/content.ts       Draft filtering, guide URLs, "which routes exist"
  components/          PatchBadge, PatchBanner, Callout, GlossaryTerm, TableOfContents,
                       Breadcrumbs, ClassCard, AscendancyCard, BuildCard, RatingBars, Header, Footer...
  layouts/             BaseLayout (SEO head, header, footer), GuideLayout (banner + ToC)
  pages/               index, start-here/, about, glossary/, search/, patches/, 404, robots.txt,
                       classes/ (index + [class]), ascendancies/[ascendancy],
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
```

A `GlossaryTerm` pointing at a missing glossary entry fails the build.

Navigation links in `src/config.ts` that don't have a page yet show a "Soon" label instead of a broken link. They become real links automatically once the page exists.

## Classes and Ascendancies

Each class lists its Ascendancies in `ascendancies:` and each Ascendancy points back with `class:`. The build fails if the two disagree, so a missing or misspelled Ascendancy can't slip through. Ascendancy `keyNodes` are shown as "Signature mechanics"; keep them as summaries in our own words.

For the Duelist at 1.0: fill in `attributes`, `beginnerFriendly` and `ascendancies`, remove `availableFrom`, and add one file per new Ascendancy.

## Adding a build (Phase 3)

Create `src/content/builds/<slug>.mdx` using the build fields in `src/content.config.ts` (`class`, `ascendancy`, `mainSkill`, `budget`, `leagueStarter`, `ssfFriendly`, `ratings`, `pobLink`, `leveling`). `class` and `ascendancy` must match file names in `content/classes/` and `content/ascendancies/`, or the build fails.

## Updating the passive tree

`/passive-tree/` draws the tree from `public/data/passive-tree.json`, which is generated from Grinding Gear Games' official [passive tree export](https://github.com/grindinggear/poe2-skilltree-export). When GGG publishes a new tree, set `TREE_VERSION` in `scripts/build-passive-tree.mjs` and run `node scripts/build-passive-tree.mjs` (or pass a local `data.json` path). Only node names, stats and positions are kept. The export's icon paths are dropped because they point at GGG artwork. Shared tree links include the version, so links made on an older tree open with an empty plan instead of the wrong nodes.

## Item icons

`<ItemIcon name="..." />` (and `unique` for uniques) shows an item's official icon, loaded from GGG's CDN. It can be used in any MDX file without importing it. Names must match the game exactly; a typo fails the build. The name → URL list lives in `src/data/item-icons.json` and is regenerated with `node scripts/build-item-icons.mjs`, which reads the item data from [Exiled Exchange 2](https://github.com/Kvan7/Exiled-Exchange-2) (MIT). Bump `SOURCE_REF` in that script to a newer release after a big patch.

## Item tooltips

Any element with `data-item="<name>"` (or `data-item="u:<name>"` for a unique) shows a game-style tooltip on hover, keyboard focus or tap. `<ItemIcon>` tiles do this automatically, and `<Item name="Divine Orb" />` adds an inline mention with icon and tooltip to any MDX guide. The script is `src/scripts/item-tooltip.ts`, loaded on every page; it fetches `public/data/item-tooltips.json` the first time someone opens a tooltip.

That file is generated. Unique mods, base stats, flavour text, essence and rune effects are game data read from [Path of Building PoE2](https://github.com/PathOfBuildingCommunity/PathOfBuilding-PoE2)'s data files (last built from commit `bb52d6b`). Currency, omen and catalyst descriptions are our own wording in `src/data/item-descriptions.json`; edit that file to add or fix one. To rebuild after a patch:

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
5. Add the Duelist and its Ascendancies, and rewrite the leveling guide for six Acts.

Evergreen pages flag too. That's intentional: they become green again once someone has checked them.

## Content rules

- Original words only. Summarise and link; never copy from wikis, patch notes or other guides.
- No Grinding Gear Games art, logos or class portraits stored in the repo. Item icons are the one exception to using their art: they're hotlinked from GGG's CDN (`<ItemIcon name="Divine Orb" />`), never downloaded or committed. Mohamed approved this in October 2026.
- Never state exchange rates or exact profits as fact. Give ranges and link to poe.ninja.
