export const prerender = false;

import type { APIRoute } from 'astro';
import crypto from 'node:crypto';
import { CMS_SECRET, CMS_USER, CMS_PASS } from '../../../lib/auth-config';

function createToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({ username, exp: Date.now() + 24 * 60 * 60 * 1000 }),
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', CMS_SECRET).update(payload).digest('base64url');
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

    if (username !== CMS_USER || password !== CMS_PASS) {
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
