import { defineConfig, loadEnv } from 'vite';
import path from 'path';
import { sentryVitePlugin } from '@sentry/vite-plugin';

// https://vitejs.dev/config
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, '');

  return {
  define: {
    // Injected at build time from the SENTRY_DSN env var (set as a GitHub
    // Actions secret). Empty string in dev → Sentry is a no-op.
    'process.env.SENTRY_DSN': JSON.stringify(env.SENTRY_DSN ?? ''),
  },
  resolve: {
    alias: {
      '@main': path.resolve(__dirname, 'src/main'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  plugins: [
    // Upload main-process source maps to Sentry only in CI (when auth token is set).
    ...(env.SENTRY_AUTH_TOKEN ? [sentryVitePlugin({
      org:       'openconduit',
      project:   env.SENTRY_PROJECT,
      authToken: env.SENTRY_AUTH_TOKEN,
      release:   { name: process.env.npm_package_version },
      sourcemaps: { assets: '.vite/build/**' },
      telemetry: false,
    })] : []),
  ],
  build: {
    sourcemap: true, // required for Sentry source map upload
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
      // Suppress the "circular dependency" warnings emitted by @smithy's export*
      // re-export graph — they are harmless build-time noise.
      onwarn(warning, defaultHandler) {
        if (warning.code === 'CIRCULAR_DEPENDENCY' && warning.ids?.some((id) => id.includes('@smithy') || id.includes('@aws-sdk'))) return;
        defaultHandler(warning);
      },
      output: {
        // pdfjs-dist (bundled via pdf-parse) has top-level `new DOMMatrix()` that runs
        // at module evaluation time. Its own polyfill loads @napi-rs/canvas via the
        // native `.node` binding, which fails in packaged Electron builds due to ABI
        // mismatch — leaving globalThis.DOMMatrix undefined and crashing on startup.
        // @napi-rs/canvas/geometry.js is pure JavaScript (no native binding) and
        // always loads successfully. This banner runs before any module code in the
        // bundle, guaranteeing DOMMatrix is defined before pdfjs is evaluated.
        banner: [
          'try {',
          '  const _geo = require(\'@napi-rs/canvas/geometry\');',
          '  if (!globalThis.DOMMatrix) globalThis.DOMMatrix = _geo.DOMMatrix;',
          '  if (!globalThis.DOMRect)   globalThis.DOMRect   = _geo.DOMRect;',
          '  if (!globalThis.DOMPoint)  globalThis.DOMPoint  = _geo.DOMPoint;',
          '} catch (_e) { /* geometry.js unavailable — DOMMatrix may crash later */ }',
        ].join('\n'),
      },
    },
  },
  };
});
