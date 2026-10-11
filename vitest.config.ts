import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Bound CPU contention while keeping independent test files in parallel.
    maxWorkers: 2,
    // Generated native QA Cargo/assets are not source test inputs.
    exclude: [...configDefaults.exclude, '.qa/**'],
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
  },
});
