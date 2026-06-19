/**
 * Shared authentication utilities for CMS API routes.
 *
 * Token format: base64url(payload).base64url(HMAC-SHA256 signature)
 * Payload: { username: string, exp: number (ms timestamp) }
 */

import crypto from 'node:crypto';
import { CMS_SECRET } from './auth-config';

export interface AuthUser {
  username: string;
}

/** Create a signed JWT-like token (valid for 24 hours). */
export function createToken(username: string): string {
  const payload = Buffer.from(
    JSON.stringify({ username, exp: Date.now() + 24 * 60 * 60 * 1000 }),
  ).toString('base64url');
  const signature = crypto.createHmac('sha256', CMS_SECRET).update(payload).digest('base64url');
  return `${payload}.${signature}`;
}

/**
 * Verify a raw token string (from header or cookie).
 * Returns the user if valid, or null if missing/expired/tampered.
 */
export function verifyTokenValue(token: string): AuthUser | null {
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

/**
 * Verify a Bearer token from the Authorization header.
 */
export function verifyToken(request: Request): AuthUser | null {
  const auth = request.headers.get('Authorization');
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return verifyTokenValue(auth.slice(7));
}

/**
 * Extract and verify a token from the `xtcms_token` cookie.
 * Used for browser-based admin page authentication.
 */
export function verifyTokenFromCookie(request: Request): AuthUser | null {
  const cookie = request.headers.get('Cookie') || '';
  const match = cookie.match(/(?:^|;\s*)xtcms_token=([^;]+)/);
  return match ? verifyTokenValue(match[1]) : null;
}
