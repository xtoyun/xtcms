export const prerender = false;

import type { APIRoute } from 'astro';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { CMS_SECRET } from '../../../lib/auth-config';
import { processUploadedImage } from '../../../lib/image-utils';

function verifyToken(request: Request): { username: string } | null {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  const token = auth.slice(7);
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [payload, signature] = parts;
  const expected = crypto.createHmac('sha256', CMS_SECRET).update(payload).digest('base64url');
  if (signature !== expected) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString());
    if (Date.now() > data.exp) return null;
    return { username: data.username };
  } catch {
    return null;
  }
}

function ensureDir(filePath: string) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
}

export const POST: APIRoute = async ({ request }) => {
  const user = verifyToken(request);
  if (!user) {
    return new Response(JSON.stringify({ error: '未授权' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const targetPath = formData.get('path')?.toString() || 'public/uploads/upload.png';

    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Save to target directory temporarily
    const cwd = process.cwd();
    const targetDir = path.dirname(path.join(cwd, targetPath));
    ensureDir(path.join(targetDir, 'tmp'));
    const tmpPath = path.join(targetDir, file.name);

    const buf = Buffer.from(await file.arrayBuffer());
    fs.writeFileSync(tmpPath, buf);

    // Process: rename + thumbnail
    const result = await processUploadedImage(tmpPath);
    if (result) {
      const dir = path.dirname(targetPath);
      const finalPath = (dir + '/' + result.newPath).replace(/\\/g, '/').replace('public/', '');
      return new Response(JSON.stringify({ path: 'public/' + finalPath }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Not an image, write to target path directly
    const absPath = path.join(cwd, targetPath);
    ensureDir(absPath);
    fs.writeFileSync(absPath, buf);
    return new Response(JSON.stringify({ path: targetPath }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: `上传失败: ${(e as Error).message}` }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
