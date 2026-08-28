import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

const articles = defineCollection({
  loader: glob({
    base: './src/content/articles',
    pattern: '**/*.{md,mdx}',
  }),
  schema: z.object({
    title: z.string(),
    seoTitle: z.string(),
    description: z.string().max(170),
    publishedAt: z.coerce.date(),
    updatedAt: z.coerce.date().optional(),
    author: z.string(),
    readingMinutes: z.number().int().positive(),
    wordCount: z.number().int().positive(),
    issue: z.number().int().positive(),
    category: z.string(),
    tags: z.array(z.string()).min(1),
    repository: z.string().url(),
    sourceCommit: z.string().regex(/^[0-9a-f]{40}$/),
    socialImage: z.string(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { articles };
