import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'module';
import { sentryVitePlugin } from '@sentry/vite-plugin';

const require = createRequire(import.meta.url);
const { version } = require('./package.json') as { version: string };

// https://vitejs.dev/config
export default defineConfig({
  plugins: [
    react(),
    // Upload renderer source maps to Sentry only in CI (when auth token is set).
    ...(process.env.SENTRY_AUTH_TOKEN ? [sentryVitePlugin({
      org:       process.env.SENTRY_ORG,
      project:   process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release:   { name: version },
      sourcemaps: { assets: '.vite/renderer/**' },
      telemetry: false,
    })] : []),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(version),
    // Injected at build time from the SENTRY_DSN env var. Empty string → no-op.
    __SENTRY_DSN__: JSON.stringify(process.env.SENTRY_DSN ?? ''),
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
});
