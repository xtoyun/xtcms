import { defineMiddleware } from 'astro:middleware';

export const onRequest = defineMiddleware(async (context, next) => {
  const url = new URL(context.request.url);

  // Redirect /admin to /admin/ so that Sveltia CMS resolves relative paths correctly
  if (url.pathname === '/admin') {
    return new Response(null, {
      status: 301,
      headers: { Location: '/admin/' },
    });
  }

  // Serve the CMS admin page at /admin/
  if (url.pathname === '/admin/') {
    const fs = await import('node:fs');
    return new Response(fs.readFileSync('public/admin/index.html', 'utf8'), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Allow all other /admin/* files (JS, config.yml, etc.) without restriction
  // Content editing is protected by JWT on /api/cms/* endpoints
  return next();
});
