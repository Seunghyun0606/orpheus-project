import { fileURLToPath } from 'node:url';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Explicit build only. Normal vite.config.ts and src/main.tsx are unchanged.
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '.qa/task024/web',
    emptyOutDir: false,
    rolldownOptions: {
      input: fileURLToPath(new URL('./qa/task024/index.html', import.meta.url)),
    },
  },
});
