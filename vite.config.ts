import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  build: {
    minify: mode === 'production' ? 'esbuild' : false,
    sourcemap: mode === 'development',
    lib: {
      entry: resolve(process.cwd(), 'src/index.ts'),
      name: 'Marquee',
      fileName: () => 'marquee.browser.js',
      formats: ['es'],
    },
    rollupOptions: {
      external: [],
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
}));
