import { defineMiddleware } from 'astro:middleware';
import fs from 'node:fs';
import path from 'node:path';

const MIME: Record<string, string> = {
  '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.gif': 'image/gif', '.webp': 'image/webp', '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf', '.ico': 'image/x-icon',
  '.mp4': 'video/mp4', '.webm': 'video/webm',
};

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Redirect /admin to /admin/
  if (url.pathname === '/admin') {
    return new Response(null, { status: 301, headers: { Location: '/admin/' } });
  }

  // Serve static files from public/ directly — bypasses dist/client copies
  // Only intercepts known static file extensions; everything else falls through to Astro
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

  // Serve CMS admin page
  if (url.pathname === '/admin/') {
    return new Response(fs.readFileSync('public/admin/index.html', 'utf8'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  return next();
});
