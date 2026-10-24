/**
 * Site-wide settings. The single most important value here is CURRENT_PATCH:
 * every content page compares its own `patch` frontmatter against it to decide
 * whether it shows an "Up to date" badge or an "may be outdated" banner.
 *
 * When 1.0 launches, change CURRENT_PATCH to "1.0" and rebuild.
 */
export const CURRENT_PATCH = '0.5.5';

export const SITE = {
  name: 'Exile Primer',
  tagline: 'A beginner-first guide to Path of Exile 2',
  description:
    'Plain-English Path of Exile 2 guides for new players: classes, leveling, builds, farming, crafting and the Atlas endgame, labelled by patch.',
  locale: 'en',
  /** Date and name of the next big game update, shown on the home page. */
  nextMilestone: { label: 'Path of Exile 2 1.0 (free-to-play launch)', date: '2026-12-11' },
} as const;

export const DISCLAIMER =
  'This site is not affiliated with or endorsed by Grinding Gear Games. Path of Exile is a trademark of Grinding Gear Games.';

export interface NavLink {
  label: string;
  href: string;
}

export interface NavSection {
  title: string;
  href: string;
  blurb: string;
  links: NavLink[];
}

/**
 * Navigation for the header mega-menu and the home page section cards.
 * Links whose route doesn't exist yet render as "Soon" instead of a dead link,
 * so this list can describe the full site map from day one.
 */
export const NAV: NavSection[] = [
  {
    title: 'Start Here',
    href: '/start-here/',
    blurb: 'Brand new? Read these first, in order.',
    links: [
      { label: 'What is PoE2?', href: '/start-here/what-is-poe2/' },
      { label: 'Choosing a class', href: '/start-here/choosing-a-class/' },
      { label: 'Core concepts', href: '/start-here/core-concepts/' },
      { label: 'Loot filters', href: '/start-here/loot-filters/' },
      { label: 'Trading', href: '/start-here/trading/' },
      { label: 'FAQ', href: '/start-here/faq/' },
    ],
  },
  {
    title: 'Classes',
    href: '/classes/',
    blurb: 'Every class and Ascendancy, compared.',
    links: [{ label: 'All classes', href: '/classes/' }],
  },
  {
    title: 'Builds',
    href: '/builds/',
    blurb: 'League starters and endgame builds.',
    links: [
      { label: 'All builds', href: '/builds/' },
      { label: 'Tier list', href: '/builds/tier-list/' },
    ],
  },
  {
    title: 'Campaign',
    href: '/campaign/',
    blurb: 'Level up fast and skip nothing important.',
    links: [
      { label: 'Overview', href: '/campaign/' },
      { label: 'Leveling guide', href: '/campaign/leveling-guide/' },
      { label: 'Ascendancy trials', href: '/campaign/ascendancy-trials/' },
      { label: 'Permanent bonuses', href: '/campaign/permanent-bonuses/' },
    ],
  },
  {
    title: 'Endgame',
    href: '/endgame/',
    blurb: 'What to do after the campaign.',
    links: [
      { label: 'Overview', href: '/endgame/' },
      { label: 'The Atlas', href: '/endgame/atlas/' },
      { label: 'Atlas tree', href: '/endgame/atlas-tree/' },
      { label: 'Masters of the Atlas', href: '/endgame/masters-of-the-atlas/' },
      { label: 'Bosses', href: '/endgame/bosses/' },
      { label: 'Progression checklist', href: '/endgame/progression-checklist/' },
    ],
  },
  {
    title: 'Farming',
    href: '/farming/',
    blurb: 'How currency really works, and how to earn it.',
    links: [
      { label: 'Farming hub', href: '/farming/' },
      { label: 'Beginner farming', href: '/farming/beginner-farming/' },
    ],
  },
  {
    title: 'Crafting',
    href: '/crafting/',
    blurb: 'Currency items and safe beginner crafts.',
    links: [
      { label: 'Crafting basics', href: '/crafting/' },
      { label: 'Currency', href: '/crafting/currency/' },
      { label: 'Essences', href: '/crafting/essences/' },
      { label: 'Omens', href: '/crafting/omens/' },
      { label: 'Strategies', href: '/crafting/strategies/' },
    ],
  },
  {
    title: 'Reference',
    href: '/glossary/',
    blurb: 'Look things up.',
    links: [
      { label: 'Glossary', href: '/glossary/' },
      { label: 'Patch history', href: '/patches/' },
      { label: 'Tools', href: '/tools/' },
      { label: 'About', href: '/about/' },
    ],
  },
];
