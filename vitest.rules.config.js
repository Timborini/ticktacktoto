import { defineConfig } from 'vitest/config';

// Separate config for Firestore security-rules tests. These run against the
// Firestore emulator (see the `test:rules` npm script) in a Node environment.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['test/**/*.test.js'],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
