export const prerender = false;

import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execSync } from 'node:child_process';

// API key for external access — set in .env, defaults to a dev key
const API_KEY = process.env.CMS_API_KEY || 'xtocn-api-key-change-me';

function today(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w一-鿿]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'untitled';
}

export const POST: APIRoute = async ({ request }) => {
  // API key auth
  const auth = request.headers.get('Authorization');
  const key = auth?.startsWith('Bearer ') ? auth.slice(7) : '';
  if (key !== API_KEY) {
    return new Response(JSON.stringify({ error: '无效的 API Key' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const body = await request.json();
    const { title, description, content, tags, image, draft } = body || {};

    if (!title || !content) {
      return new Response(JSON.stringify({ error: 'title 和 content 为必填字段' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const slug = slugify(title);
    const dateStr = today();
    const ts = Date.now();
    const filename = `${dateStr}-${slug}-${String(ts).slice(-6)}.md`;

    const tagList = Array.isArray(tags) ? tags : [];
    const tagsYaml = tagList.length ? `\ntags: [${tagList.map(t => `"${t}"`).join(', ')}]` : '';
    const descYaml = description ? `\ndescription: "${description.replace(/"/g, '\\"')}"` : '';
    const imageYaml = image ? `\nimage: "${image}"` : '';

    const md = `---
title: "${title.replace(/"/g, '\\"')}"${descYaml}
date: ${dateStr}${tagsYaml}${imageYaml}
pinned: false
draft: ${draft ? 'true' : 'false'}
---

${content}
`;

    const postsDir = path.join(process.cwd(), 'src/content/posts');
    fs.mkdirSync(postsDir, { recursive: true });
    fs.writeFileSync(path.join(postsDir, filename), md, 'utf8');

    // Git commit (best effort)
    try {
      execSync('git add -A', { cwd: process.cwd(), timeout: 5000 });
      execSync(`git commit -m "API: new article — ${title}" --author="API <api@xtocn.com>"`, {
        cwd: process.cwd(),
        timeout: 5000,
        env: { ...process.env, GIT_AUTHOR_NAME: 'API', GIT_AUTHOR_EMAIL: 'api@xtocn.com', GIT_COMMITTER_NAME: 'API', GIT_COMMITTER_EMAIL: 'api@xtocn.com' },
      });
    } catch { /* git optional */ }

    return new Response(JSON.stringify({
      success: true,
      slug: filename.replace('.md', ''),
      url: `/posts/${filename.replace('.md', '')}`,
      filename,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `提交失败: ${(e as Error).message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
