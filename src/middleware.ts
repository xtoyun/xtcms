import { defineMiddleware } from 'astro:middleware';
import fs from 'node:fs';
import path from 'node:path';
import { generateCMSConfig } from './core/config-engine';

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
  '.css': 'text/css', '.js': 'application/javascript',
  '.json': 'application/json', '.yml': 'application/yaml',
};

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Redirect /admin to /admin/
  if (url.pathname === '/admin') {
    return new Response(null, { status: 301, headers: { Location: '/admin/' } });
  }

  // ── Dynamic CMS config ──
  if (url.pathname === '/admin/config.yml') {
    try {
      const yaml = generateCMSConfig(undefined, context.request);
      return new Response(yaml, {
        headers: { 'Content-Type': 'application/yaml; charset=utf-8', 'Cache-Control': 'no-cache' },
      });
    } catch (e: any) {
      return new Response(`# Config generation error\n# ${e.message}`, {
        status: 500,
        headers: { 'Content-Type': 'text/plain' },
      });
    }
  }

  // ── Serve static files from public/ ──
  const ext = path.extname(url.pathname).toLowerCase();
  if (ext && MIME[ext]) {
    const publicPath = path.join(process.cwd(), 'public', url.pathname);
    if (fs.existsSync(publicPath)) {
      const buf = fs.readFileSync(publicPath);
      return new Response(buf, {
        headers: { 'Content-Type': MIME[ext], 'Cache-Control': 'public, max-age=31536000' },
      });
    }
  }

  // ── Serve CMS admin page ──
  if (url.pathname === '/admin/') {
    const indexPath = path.join(process.cwd(), 'public/admin/index.html');
    if (fs.existsSync(indexPath)) {
      return new Response(fs.readFileSync(indexPath, 'utf8'), {
        headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache' },
      });
    }
    return new Response('CMS not built. Run: cd sveltia-cms && pnpm build', { status: 404 });
  }

  return next();
});
