import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: { name: 'mock-lms', include: ['test/**/*.test.ts'], environment: 'node' },
});
