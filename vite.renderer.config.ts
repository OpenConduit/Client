import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version } = require('./package.json') as { version: string };

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  // Load .env from this package directory — empty prefix picks up all vars,
  // not just VITE_-prefixed ones (e.g. SENTRY_DSN, which we don't want
  // accidentally exposed to the browser via import.meta.env).
  const env = loadEnv(mode, __dirname, '');

  return {
  plugins: [
    react(),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // Injected at build time from SENTRY_DSN in .env or the shell environment.
    // Empty string → Sentry.init() receives undefined and no-ops.
    __SENTRY_DSN__: JSON.stringify(env.SENTRY_DSN ?? ''),
  },
  build: {
    // 'hidden' still emits source maps (uploaded to Sentry via sentry-cli in the
    // forge packageAfterCopy hook) but omits the sourceMappingURL comment, so maps
    // are never referenced by — or shipped to — end users.
    sourcemap: 'hidden',
  },
  css: {
    postcss: './postcss.config.cjs',
  },
  resolve: {
    alias: {
      '@renderer': path.resolve(__dirname, 'src/renderer'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@openconduit/core': path.resolve(__dirname, 'node_modules/@openconduit/core/src'),
    },
  },
  optimizeDeps: {
    // Scan core's full source tree so Vite discovers and pre-bundles every
    // CJS-only transitive dep (mermaid → cytoscape, highlight.js, extend,
    // katex, etc.) without needing an explicit include list that rots over time.
    entries: [
      'src/renderer.ts',
      'node_modules/@openconduit/core/src/index.ts',
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
  };
});
