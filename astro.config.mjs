// @ts-check
import { defineConfig } from 'astro/config';
import { loadEnv } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';
import { templateChainPlugin } from './src/core/vite-plugin.js';

const env = loadEnv(process.env.NODE_ENV || 'development', process.cwd(), '');

export default defineConfig({
  devToolbar: { enabled: false },
  output: 'server',
  prefetch: true,
  security: { checkOrigin: false },
  vite: {
    plugins: [
      tailwindcss(),
      templateChainPlugin(),
    ],
  },
  cacheDir: './node_modules/.astro-cache',
  server: { host: '0.0.0.0', port: Number(env.PORT) || 4321 },
  adapter: node({ mode: 'standalone' }),
});
