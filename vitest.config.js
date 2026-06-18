import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/**/*.test.js'],
    coverage: {
      provider: 'v8',
      include: ['worker/worker.js', 'js/*.js'],
      exclude: ['js/fallback.js', 'js/map.js'],
      reporter: ['text', 'html'],
    },
  },
});
