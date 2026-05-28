import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'module';
import { sentryVitePlugin } from '@sentry/vite-plugin';

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
    // Upload renderer source maps to Sentry only in CI (when auth token is set).
    ...(env.SENTRY_AUTH_TOKEN ? [sentryVitePlugin({
      org:       'openconduit',
      project:   env.SENTRY_PROJECT,
      authToken: env.SENTRY_AUTH_TOKEN,
      release:   { name: version },
      sourcemaps: { assets: '.vite/renderer/**' },
      telemetry: false,
    })] : []),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // Injected at build time from SENTRY_DSN in .env or the shell environment.
    // Empty string → Sentry.init() receives undefined and no-ops.
    __SENTRY_DSN__: JSON.stringify(env.SENTRY_DSN ?? ''),
  },
  build: {
    sourcemap: true, // required for Sentry source map upload
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
