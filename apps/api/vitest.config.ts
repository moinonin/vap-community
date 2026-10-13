import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    alias: {
      '@verified-attention/verifier': '/Users/nickrotich/Desktop/portfolio/projects/python/verified-attention/apps/verifier/src/index.ts',
    },
  },
});