import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { version } = require('./package.json');
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
            '@openconduit/core': path.resolve(__dirname, '../core/src'),
        },
    },
});
//# sourceMappingURL=vite.renderer.config.js.map