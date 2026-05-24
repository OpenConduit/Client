import { defineConfig } from 'vite';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  build: {
    rollupOptions: {
      // Optional native modules used by ws / @google/genai — not needed at runtime.
      // @aws-sdk/* and @smithy/* use circular re-exports that confuse Rollup; mark
      // them external so Electron requires them directly from node_modules instead.
      external: [
        'bufferutil',
        'utf-8-validate',
        /^@aws-sdk\//,
        /^@smithy\//,
      ],
    },
  },
});
