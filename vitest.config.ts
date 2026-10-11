import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Bound CPU contention while keeping independent test files in parallel.
    maxWorkers: 2,
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
  },
});
