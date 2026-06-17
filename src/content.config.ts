import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    description: z.string().optional(),
    date: z.coerce.date(),
    image: z.string().optional(),
    tags: z.union([z.array(z.string()), z.string()]).optional().transform(v => typeof v === 'string' ? [] : v),
    draft: z.boolean().optional().default(false),
  }),
});

const projects = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/projects' }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    image: z.string().optional(),
    category: z.enum(['品牌建设', '网站建设', '网络营销', '自媒体', '数字化管理']),
    client: z.string().optional(),
    date: z.union([z.coerce.date(), z.string()]).optional(),
    featured: z.boolean().optional().default(false),
    link: z.string().optional(),
  }),
});

const services = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/services' }),
  schema: z.object({
    title: z.string(),
    icon: z.string().optional().default('📌'),
    description: z.string(),
    order: z.number().optional().default(0),
  }),
});

const messages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/messages' }),
  schema: z.object({
    name: z.string(),
    company: z.string().optional(),
    phone: z.string(),
    email: z.string().optional(),
    date: z.union([z.coerce.date(), z.string()]),
    read: z.boolean().optional().default(false),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
  }),
});

export const collections = { posts, projects, services, messages, pages };
