// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

export default defineConfig({
  devToolbar: { enabled: false },
  output: 'server',
  prefetch: true,
  security: { checkOrigin: false },
  vite: { plugins: [tailwindcss()] },
  cacheDir: './node_modules/.astro-cache',
  site: 'https://www.xtocn.com',
  build: { assets: 'assets' },
  server: { host: '0.0.0.0', port: Number(env.PORT) || 4321 },
  adapter: node({ mode: 'standalone' }),
});
