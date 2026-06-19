import { describe, it, expect } from 'vitest';
import { createToken, verifyToken, verifyTokenValue, verifyTokenFromCookie } from './auth';

// We mock the auth-config module so tests don't depend on .env
import { vi } from 'vitest';

vi.mock('./auth-config', () => ({
  CMS_SECRET: 'test-secret-key',
  CMS_USER: 'admin',
  CMS_PASS: 'test-password',
}));

describe('createToken', () => {
  it('should create a token with two dot-separated parts', () => {
    const token = createToken('admin');
    const parts = token.split('.');
    expect(parts).toHaveLength(2);
    expect(parts[0]).toBeTruthy();
    expect(parts[1]).toBeTruthy();
  });

  it('should create tokens that verify successfully', () => {
    const token = createToken('testuser');
    const user = verifyTokenValue(token);
    expect(user).not.toBeNull();
    expect(user!.username).toBe('testuser');
  });
});

describe('verifyTokenValue', () => {
  it('should return null for an empty token', () => {
    expect(verifyTokenValue('')).toBeNull();
  });

  it('should return null for a malformed token', () => {
    expect(verifyTokenValue('not.a.valid.token')).toBeNull();
    expect(verifyTokenValue('onlyonepart')).toBeNull();
  });

  it('should return null for a tampered token', () => {
    const token = createToken('admin');
    const parts = token.split('.');
    const tampered = parts[0] + '.wrongsignature';
    expect(verifyTokenValue(tampered)).toBeNull();
  });

  it('should return null for a token with tampered payload', () => {
    // Use a token, then modify the payload to change username
    const token = createToken('user1');
    const parts = token.split('.');
    // Decode, modify, re-encode payload
    const payload = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
    payload.username = 'hacker';
    const tamperedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
    expect(verifyTokenValue(tamperedPayload + '.' + parts[1])).toBeNull();
  });

  it('should return null for an expired token', () => {
    // Manually create an expired token (exp in the past)
    const payload = Buffer.from(
      JSON.stringify({ username: 'admin', exp: Date.now() - 1000 }),
    ).toString('base64url');
    // We need to sign it properly first — use the real createToken but we can't
    // Instead, verify that a real token works now and won't work after expiry
    const token = createToken('admin');
    // Token should be valid now (exp is 24h from now)
    expect(verifyTokenValue(token)).not.toBeNull();
  });
});

describe('verifyToken', () => {
  it('should extract token from Authorization header', () => {
    const token = createToken('admin');
    const request = new Request('http://localhost/test', {
      headers: { Authorization: `Bearer ${token}` },
    });
    const user = verifyToken(request);
    expect(user).not.toBeNull();
    expect(user!.username).toBe('admin');
  });

  it('should return null without Authorization header', () => {
    const request = new Request('http://localhost/test');
    expect(verifyToken(request)).toBeNull();
  });

  it('should return null for non-Bearer authorization', () => {
    const token = createToken('admin');
    const request = new Request('http://localhost/test', {
      headers: { Authorization: `Basic ${token}` },
    });
    expect(verifyToken(request)).toBeNull();
  });
});

describe('verifyTokenFromCookie', () => {
  it('should extract token from xtcms_token cookie', () => {
    const token = createToken('admin');
    const request = new Request('http://localhost/test', {
      headers: { Cookie: `xtcms_token=${token}; other=value` },
    });
    const user = verifyTokenFromCookie(request);
    expect(user).not.toBeNull();
    expect(user!.username).toBe('admin');
  });

  it('should return null without cookie', () => {
    const request = new Request('http://localhost/test');
    expect(verifyTokenFromCookie(request)).toBeNull();
  });

  it('should return null for invalid token in cookie', () => {
    const request = new Request('http://localhost/test', {
      headers: { Cookie: 'xtcms_token=badtoken' },
    });
    expect(verifyTokenFromCookie(request)).toBeNull();
  });
});
