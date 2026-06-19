/**
 * Standard API response helpers.
 *
 * All JSON endpoints should use these to ensure a consistent response format:
 *   - Errors:   { error: string, code: number }
 *   - Success:  JSON body with 200 (or custom status)
 */

export interface ApiErrorBody {
  error: string;
  code: number;
}

/** Return a JSON error response with consistent shape. */
export function apiError(message: string, status: number = 500): Response {
  const body: ApiErrorBody = { error: message, code: status };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/** Return a JSON success response. */
export function apiSuccess(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
