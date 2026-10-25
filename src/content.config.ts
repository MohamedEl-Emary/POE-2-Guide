import { defineCollection, reference } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const contentGlob = (dir: string) => glob({ pattern: '**/[^_]*.{md,mdx}', base: `./src/content/${dir}` });

const version = z.string().regex(/^\d+\.\d+(\.\d+)?$/, 'Use a version like "0.5.5" or "1.0"');
const rating = z.number().int().min(1).max(5);

/** Frontmatter shared by every guide-type page (classes, builds, guides...). */
const baseSchema = z.object({
  title: z.string().min(3),
  description: z
    .string()
    .min(140, 'Meta description must be 140-160 characters')
    .max(160, 'Meta description must be 140-160 characters'),
  /** Game version the content was written for. */
  patch: version,
  /** Date someone last confirmed the page is accurate. */
  lastVerified: z.coerce.date(),
  status: z.enum(['current', 'needs-review', 'outdated']).default('current'),
  difficulty: z.enum(['beginner', 'intermediate', 'advanced']).default('beginner'),
  tags: z.array(z.string()).default([]),
  /** Drafts are visible in `pnpm dev` but excluded from production builds. */
  draft: z.boolean().default(false),
  /** Show in "featured" lists on the home page (ignored when outdated). */
  featured: z.boolean().default(false),
});

const classes = defineCollection({
  loader: contentGlob('classes'),
  schema: baseSchema.extend({
    attributes: z.array(z.enum(['str', 'dex', 'int'])).max(2),
    weapons: z.array(z.string()).min(1),
    ascendancies: z.array(reference('ascendancies')).default([]),
    playstyle: z.string(),
    /** Site opinion, 1-5. Leave out for classes that aren't playable yet. */
    beginnerFriendly: rating.optional(),
    /** Position in the class grid. */
    order: z.number().int().default(100),
    /** Set for classes that aren't playable yet (e.g. Duelist before 1.0). */
    availableFrom: version.optional(),
  }),
});

const ascendancies = defineCollection({
  loader: contentGlob('ascendancies'),
  schema: baseSchema.extend({
    class: reference('classes'),
    addedInPatch: version,
    keyNodes: z.array(z.object({ name: z.string(), summary: z.string() })).default([]),
    bestFor: z.array(z.string()).default([]),
  }),
});

const builds = defineCollection({
  loader: contentGlob('builds'),
  schema: baseSchema.extend({
    class: reference('classes'),
    ascendancy: reference('ascendancies'),
    mainSkill: z.string(),
    budget: z.enum(['starter', 'low', 'medium', 'high']),
    leagueStarter: z.boolean(),
    ssfFriendly: z.boolean(),
    ratings: z.object({
      clear: rating,
      singleTarget: rating,
      defense: rating,
      easeOfPlay: rating,
    }),
    pobLink: z.url().optional(),
    leveling: z.boolean(),
    /** How the build plays, used by the builds filter. */
    playstyle: z.enum(['melee', 'ranged', 'caster', 'minion']),
    /** Tier list placement (this site's opinion). */
    tier: z.enum(['S', 'A', 'B', 'C']),
    /** Farming strategies (file names in content/guides/farming) that suit this build. */
    farms: z.array(z.string()).default([]),
  }),
});

const guides = defineCollection({
  loader: contentGlob('guides'),
  schema: baseSchema.extend({
    section: z.enum(['start-here', 'campaign', 'endgame', 'farming', 'crafting', 'reference']),
    /** Position in the section's reading order (lower first). */
    order: z.number().int().default(100),
  }),
});

const glossary = defineCollection({
  loader: contentGlob('glossary'),
  schema: z.object({
    term: z.string(),
    /** One sentence, shown in inline tooltips. */
    short: z.string().max(180),
    aliases: z.array(z.string()).default([]),
    related: z.array(reference('glossary')).default([]),
  }),
});

const patches = defineCollection({
  loader: contentGlob('patches'),
  schema: z.object({
    version,
    title: z.string(),
    releaseDate: z.coerce.date(),
    league: z.string().optional(),
    /** One-line "what it means for new players". */
    summary: z.string(),
    upcoming: z.boolean().default(false),
  }),
});

export const collections = { classes, ascendancies, builds, guides, glossary, patches };
