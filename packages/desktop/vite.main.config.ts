import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@openconduit/core': path.resolve(__dirname, '../core/src'),
    },
  },
  build: {
    rollupOptions: {
      // Optional native modules used by ws / @google/genai — not needed at runtime
      external: ['bufferutil', 'utf-8-validate'],
    },
  },
});
