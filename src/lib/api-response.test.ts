import { describe, it, expect } from 'vitest';
import { apiError, apiSuccess } from './api-response';

describe('apiError', () => {
  it('should return a JSON response with error and code', async () => {
    const response = apiError('Something went wrong', 400);
    expect(response.status).toBe(400);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body.error).toBe('Something went wrong');
    expect(body.code).toBe(400);
  });

  it('should default to status 500', async () => {
    const response = apiError('Internal error');
    expect(response.status).toBe(500);

    const body = await response.json();
    expect(body.code).toBe(500);
  });
});

describe('apiSuccess', () => {
  it('should return a JSON response with 200 by default', async () => {
    const response = apiSuccess({ ok: true });
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');

    const body = await response.json();
    expect(body.ok).toBe(true);
  });

  it('should support custom status codes', async () => {
    const response = apiSuccess({ created: true }, 201);
    expect(response.status).toBe(201);
  });

  it('should handle arrays', async () => {
    const response = apiSuccess([1, 2, 3]);
    const body = await response.json();
    expect(body).toEqual([1, 2, 3]);
  });
});
