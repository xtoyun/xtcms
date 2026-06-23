import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.string(),
    tags: z.array(z.string()).optional().default([]),
    image: z.string().optional(),
    pinned: z.boolean().optional().default(false),
    draft: z.boolean().optional().default(false),
    link: z.string().optional(),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    date: z.coerce.string().optional(),
    image: z.string().optional(),
    pinned: z.boolean().optional().default(false),
    video: z.string().optional(),
  }),
});

const keywords = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/keywords' }),
  schema: z.object({
    keyword: z.string(),
    link: z.string(),
    date: z.coerce.string().optional(),
  }),
});

const messages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/messages' }),
  schema: z.object({
    name: z.string(),
    company: z.string().optional(),
    phone: z.string(),
    email: z.string().optional(),
    date: z.coerce.string(),
    read: z.boolean().optional().default(false),
  }),
});

const links = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/links' }),
  schema: z.object({
    title: z.string(),
    url: z.string(),
    description: z.string().optional(),
    order: z.number().optional(),
  }),
});

export const collections = { posts, pages, keywords, messages, links };