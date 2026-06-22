import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';

/**
 * POST /api/contact
 * Save contact form submission to messages collection.
 */
export const POST: APIRoute = async ({ request, redirect }) => {
  const formData = await request.formData();
  const name = formData.get('name')?.toString() || '';
  const company = formData.get('company')?.toString() || '';
  const phone = formData.get('phone')?.toString() || '';
  const email = formData.get('email')?.toString() || '';
  const message = formData.get('message')?.toString() || '';

  if (!name || !phone) {
    return new Response('姓名和电话为必填项', { status: 400 });
  }

  const dateStr = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const fileName = `${dateStr}.md`;
  const dir = path.join(process.cwd(), 'src/content/messages');
  fs.mkdirSync(dir, { recursive: true });

  const content = `---
name: ${escapeYaml(name)}
company: ${escapeYaml(company)}
phone: ${escapeYaml(phone)}
email: ${escapeYaml(email)}
date: ${new Date().toISOString().slice(0, 10)}
read: false
---

${message}
`;

  fs.writeFileSync(path.join(dir, fileName), content, 'utf8');

  return redirect('/contact/success');
};

function escapeYaml(val: string): string {
  if (val.includes(':') || val.includes('#') || val.includes("'") || val.includes('"')) {
    return `"${val.replace(/"/g, '\\"')}"`;
  }
  return val;
}
