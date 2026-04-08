import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

const dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@familyco/ui': path.resolve(dirname, '../../packages/ui/src/index.ts')
    }
  },
  build: {
    minify: 'esbuild',
    sourcemap: process.env.VITE_BUILD_SOURCEMAP === 'true',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined;
          }

          if (id.includes('/vue/') || id.includes('/vue-router/') || id.includes('/pinia/')) {
            return 'vue-vendor';
          }

          return 'vendor';
        }
      }
    }
  },
  server: {
    port: 5173,
    host: '127.0.0.1'
  }
});
