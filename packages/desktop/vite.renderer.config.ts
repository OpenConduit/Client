import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version } = require('./package.json') as { version: string };

// https://vitejs.dev/config
export default defineConfig({
  plugins: [react()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  css: {
    postcss: './postcss.config.cjs',
  },
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@openconduit/core': path.resolve(__dirname, '../../node_modules/@openconduit/core/src'),
    },
  },
  optimizeDeps: {
    // Scan core's full source tree so Vite discovers and pre-bundles every
    // CJS-only transitive dep (mermaid → cytoscape, highlight.js, extend,
    // katex, etc.) without needing an explicit include list that rots over time.
    entries: [
      'src/renderer.ts',
      '../../node_modules/@openconduit/core/src/index.ts',
    ],
    // Exclude all @openconduit/core sub-path imports from pre-bundling.
    // The alias above resolves them to raw TS filesystem paths, so every
    // import lands on the same /@fs/…/services/index.ts URL — one module
    // instance shared by renderer.ts (initService caller) and the stores
    // (service consumer).  If Vite pre-bundled @openconduit/core/services it
    // would create a separate @openconduit_core_services.js chunk with its
    // own _instance = null, breaking the initService singleton.
    exclude: [
      '@openconduit/core',
      '@openconduit/core/services',
      '@openconduit/core/App',
    ],
  },
});
