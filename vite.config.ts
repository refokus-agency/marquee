import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig(({ mode }) => ({
  build: {
    emptyOutDir: false,
    minify: mode === 'production' ? 'esbuild' : false,
    sourcemap: mode === 'development' ? 'inline' : false,
    lib: {
      entry: resolve(process.cwd(), 'src/index.ts'),
      name: 'Marquee',
      fileName: () => 'marquee.browser.js',
      formats: ['es'],
    },
    rollupOptions: {
      external: (id) => id === 'gsap' || id.startsWith('gsap/'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    coverage: {
      // Test scaffolding is not shipped code — measuring it only dilutes the
      // number for src/. Vitest excludes `*.test.ts` on its own; the shared
      // helpers under __tests__ need saying explicitly.
      exclude: ['src/__tests__/**'],
    },
  },
}));
