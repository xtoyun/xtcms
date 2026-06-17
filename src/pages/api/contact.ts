export const prerender = false;

import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

export const POST: APIRoute = async ({ request, url }) => {
  try {
    const data = await request.formData();
    const name = data.get('name')?.toString() || '';
    const company = data.get('company')?.toString() || '';
    const phone = data.get('phone')?.toString() || '';
    const email = data.get('email')?.toString() || '';
    const message = data.get('message')?.toString() || '';

    const now = new Date();
    const slug = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const dateStr = now.toISOString().slice(0, 10);

    const content = `---
name: "${name}"
company: "${company}"
phone: "${phone}"
email: "${email}"
date: "${dateStr}"
read: false
---

${message}
`;

    const dir = path.join(process.cwd(), 'src/content/messages');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, `${slug}.md`), content, 'utf8');

    return new Response(null, {
      status: 302,
      headers: { Location: '/contact/success' }
    });
  } catch (e) {
    return new Response('提交失败：' + (e as Error).message, { status: 500 });
  }
};
