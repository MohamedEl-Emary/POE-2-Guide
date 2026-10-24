import { getCollection, type CollectionEntry } from 'astro:content';

type DraftableCollection = 'classes' | 'ascendancies' | 'builds' | 'guides';

/** Collection entries minus drafts (drafts are kept in dev so authors can preview them). */
export async function getPublished<C extends DraftableCollection>(collection: C): Promise<CollectionEntry<C>[]> {
  const entries = (await getCollection(collection)) as CollectionEntry<C>[];
  return entries.filter((entry) => import.meta.env.DEV || !entry.data.draft);
}

/** URL for a guide entry: src/content/guides/start-here/faq.mdx -> /start-here/faq/ */
export function guideHref(entry: CollectionEntry<'guides'>): string {
  return `/${entry.id.replace(/\/?index$/, '')}/`.replace(/\/+/g, '/');
}

const STATIC_ROUTES = ['/', '/start-here/', '/about/', '/glossary/', '/search/', '/classes/', '/patches/'];

/** Every route that exists in this build, used to grey out nav links for pages not written yet. */
export async function getLiveRoutes(): Promise<Set<string>> {
  const [guides, classes, ascendancies] = await Promise.all([
    getPublished('guides'),
    getPublished('classes'),
    getPublished('ascendancies'),
  ]);
  return new Set([
    ...STATIC_ROUTES,
    ...guides.map(guideHref),
    ...classes.map((c) => `/classes/${c.id}/`),
    ...ascendancies.map((a) => `/ascendancies/${a.id}/`),
  ]);
}

export const ATTRIBUTE_NAMES = { str: 'Strength', dex: 'Dexterity', int: 'Intelligence' } as const;

/** MDX components available in every content file without importing them. */
export { default as Callout } from '../components/Callout.astro';
export { default as GlossaryTerm } from '../components/GlossaryTerm.astro';
