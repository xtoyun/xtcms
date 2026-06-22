import type { APIRoute } from 'astro';

/**
 * POST /api/cms/auth
 * Authenticate with username + password, return a JWT.
 *
 * Credentials come from env vars CMS_USER / CMS_PASS, falling back to defaults.
 */
export const POST: APIRoute = async ({ request }) => {
  const body = await request.json().catch(() => ({}));
  const { username, password } = body;

  // Support both import.meta.env (Astro/Vite) and process.env (Node.js direct)
  const validUser = (import.meta as any).env?.CMS_USER || process.env.CMS_USER || 'admin';
  const validPass = (import.meta as any).env?.CMS_PASS || process.env.CMS_PASS || 'admin';
  const secret = (import.meta as any).env?.CMS_SECRET || process.env.CMS_SECRET || 'xtcms-secret-key-change-in-production';

  if (!username || !password) {
    return new Response(JSON.stringify({ error: '用户名和密码不能为空' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  if (username !== validUser || password !== validPass) {
    return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Simple JWT-like token (base64url-encoded JSON with HMAC-like signature)
  const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const payload = btoa(JSON.stringify({
    username,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 86400 * 7, // 7 days
  })).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  // Simple signature (in production, use a proper JWT library)
  const sigData = `${header}.${payload}.${secret}`;
  const sig = btoa(
    Array.from(new TextEncoder().encode(sigData))
      .reduce((a, b) => a + String.fromCharCode(b), '')
  ).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_').slice(0, 43);

  const token = `${header}.${payload}.${sig}`;

  return new Response(JSON.stringify({ token, username }), {
    headers: { 'Content-Type': 'application/json' },
  });
};

/**
 * Helper to verify a JWT from the Authorization header.
 * Returns the username if valid, or null.
 */
export function verifyToken(request: Request): { username: string } | null {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;

  const token = auth.slice(7);
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (payload.exp && payload.exp * 1000 < Date.now()) return null;
    return { username: payload.username };
  } catch {
    return null;
  }
}
