import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Explicit build only. Normal vite.config.ts and src/main.tsx are unchanged.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '.qa/native/web',
    emptyOutDir: false,
    rolldownOptions: {
      input: fileURLToPath(new URL('./qa/native/index.html', import.meta.url)),
    },
  },
});
