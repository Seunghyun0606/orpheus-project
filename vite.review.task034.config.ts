import { defineConfig } from 'vite';
import production from './vite.config.ts';

// Real production entry, isolated output. No dev server or fixture substitution.
export default defineConfig({
  ...production,
  build: { outDir: '.qa/task034/web', emptyOutDir: false },
});
