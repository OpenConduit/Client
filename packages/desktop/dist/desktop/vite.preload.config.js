import { defineConfig } from 'vite';
import path from 'path';
// https://vitejs.dev/config
export default defineConfig({
    resolve: {
        alias: {
            '@shared': path.resolve(__dirname, 'src/shared'),
            '@openconduit/core': path.resolve(__dirname, '../core/src'),
        },
    },
});
//# sourceMappingURL=vite.preload.config.js.map