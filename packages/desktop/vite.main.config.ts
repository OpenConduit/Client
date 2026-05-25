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
      // @aws-sdk/* and @smithy/* were previously external but that breaks packaged
      // builds: with npm workspaces hoisting, those packages live at the workspace
      // root node_modules/ which electron-forge never copies into the .asar.
      // Bundling them with Vite is the correct fix.
      external: [
        'bufferutil',
        'utf-8-validate',
      ],
    },
  },
});
