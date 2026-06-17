// CMS authentication configuration.
// Reads from .env in dev mode (loaded by Vite via import.meta.env).
// In production, reads from process.env (set by Node --env-file or system env).

function env(key: string): string | undefined {
  // In Astro dev, Vite injects .env into import.meta.env
  // In production SSR, process.env is the source
  return (import.meta.env as Record<string, string>)[key] ?? process.env[key];
}

const isDev = process.env.NODE_ENV !== 'production' && !env('CMS_SECRET');

export const CMS_SECRET = isDev ? 'xtocn-cms-dev-secret' : env('CMS_SECRET')!;
export const CMS_USER = isDev ? 'admin' : env('CMS_USER')!;
export const CMS_PASS = isDev ? 'admin' : env('CMS_PASS')!;

if (!isDev && (!CMS_SECRET || !CMS_USER || !CMS_PASS)) {
  throw new Error(
    'CMS_SECRET, CMS_USER, and CMS_PASS must be set in .env or system environment',
  );
}
