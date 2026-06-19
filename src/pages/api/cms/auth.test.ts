import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock auth-config BEFORE importing the handler
vi.mock('../../../lib/auth-config', () => ({
  CMS_SECRET: 'test-secret',
  CMS_USER: 'admin',
  CMS_PASS: 'correct-password',
}));

// We need to re-import after the mock is set up
// But vitest hoists vi.mock() to the top, so this works
import { POST } from './auth';

function buildRequest(body: unknown, headers?: Record<string, string>): Request {
  return new Request('http://localhost/api/cms/auth', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  });
}

describe('POST /api/cms/auth', () => {
  let response: Response;
  let body: Record<string, unknown>;

  describe('with valid credentials', () => {
    beforeEach(async () => {
      response = await POST({ request: buildRequest({ username: 'admin', password: 'correct-password' }) } as any);
      body = await response.json();
    });

    it('should return 200', () => {
      expect(response.status).toBe(200);
    });

    it('should return a token and name', () => {
      expect(body.token).toBeTruthy();
      expect(typeof body.token).toBe('string');
      expect(body.name).toBe('admin');
    });

    it('should set the xtcms_token cookie', () => {
      const setCookie = response.headers.get('Set-Cookie');
      expect(setCookie).toBeTruthy();
      expect(setCookie).toContain('xtcms_token=');
      expect(setCookie).toContain('HttpOnly');
      expect(setCookie).toContain('SameSite=Lax');
      expect(setCookie).toContain('Path=/');
    });

    it('should produce a token that contains two dot-separated parts', () => {
      const parts = (body.token as string).split('.');
      expect(parts).toHaveLength(2);
    });
  });

  describe('with wrong password', () => {
    beforeEach(async () => {
      response = await POST({ request: buildRequest({ username: 'admin', password: 'wrong' }) } as any);
      body = await response.json();
    });

    it('should return 401', () => {
      expect(response.status).toBe(401);
    });

    it('should return an error message', () => {
      expect(body.error).toBeTruthy();
      expect(body.code).toBe(401);
    });
  });

  describe('with missing credentials', () => {
    it('should return 400 for empty body', async () => {
      const req = new Request('http://localhost/api/cms/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const response = await POST({ request: req } as any);
      expect(response.status).toBe(400);
    });

    it('should return 400 for missing password', async () => {
      const response = await POST({ request: buildRequest({ username: 'admin' }) } as any);
      expect(response.status).toBe(400);
    });
  });

  describe('with malformed request', () => {
    it('should return 400 for non-JSON body', async () => {
      const req = new Request('http://localhost/api/cms/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain' },
        body: 'not json',
      });
      const response = await POST({ request: req } as any);
      expect(response.status).toBe(400);
    });
  });
});
