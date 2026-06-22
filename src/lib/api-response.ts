export interface ApiErrorBody {
  error: string;
  code: number;
}

export function apiError(message: string, status: number = 500): Response {
  return new Response(JSON.stringify({ error: message, code: status }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function apiSuccess(data: unknown, status: number = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
