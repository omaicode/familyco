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
  server: {
    port: 5173,
    host: '127.0.0.1'
  }
});
