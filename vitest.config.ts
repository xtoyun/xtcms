import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    // Astro API routes use process.cwd() which needs to be the project root
    root: '.',
  },
});
