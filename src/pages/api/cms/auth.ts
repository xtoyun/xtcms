export const prerender = false;

import type { APIRoute } from 'astro';
import { CMS_USER, CMS_PASS } from '../../../lib/auth-config';
import { createToken } from '../../../lib/auth';
import { apiError, apiSuccess } from '../../../lib/api-response';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { username, password } = body || {};

    if (!username || !password) {
      return apiError('用户名和密码不能为空', 400);
    }

    if (username !== CMS_USER || password !== CMS_PASS) {
      return apiError('用户名或密码错误', 401);
    }

    const token = createToken(username);
    const response = new Response(JSON.stringify({ token, name: username }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Set-Cookie': `xtcms_token=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${24 * 60 * 60}`,
      },
    });
    return response;
  } catch {
    return apiError('请求格式错误', 400);
  }
};
