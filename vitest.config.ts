import react from '@vitejs/plugin-react';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  test: {
    // Bound CPU contention while keeping independent test files in parallel.
    maxWorkers: 2,
    // Generated native QA Cargo/assets are not source test inputs.
    // Node's native test runner owns this harness; npm run test:release-harness
    // remains mandatory and independently logged, not silently omitted coverage.
    exclude: [...configDefaults.exclude, '.qa/**', 'scripts/release-harness.test.mjs'],
    environment: 'jsdom',
    setupFiles: ['./src/tests/setup.ts'],
  },
});
