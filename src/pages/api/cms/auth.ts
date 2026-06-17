export const prerender = false;

import type { APIRoute } from 'astro';
import crypto from 'node:crypto';

const SECRET = process.env.CMS_SECRET || 'xtocn-cms-secret-change-in-production-2026';
const ADMIN_USER = process.env.CMS_USER || 'admin';
const ADMIN_PASS = process.env.CMS_PASS || 'xtocn2026';

function createToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({ username, exp: Date.now() + 24 * 60 * 60 * 1000 }),
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { username, password } = body || {};

    if (!username || !password) {
      return new Response(JSON.stringify({ error: '用户名和密码不能为空' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (username !== ADMIN_USER || password !== ADMIN_PASS) {
      return new Response(JSON.stringify({ error: '用户名或密码错误' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const token = createToken(username);

    return new Response(JSON.stringify({ token, name: username }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch {
    return new Response(JSON.stringify({ error: '请求格式错误' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};
