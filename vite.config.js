import { defineConfig } from 'vite'

// GitHub Pages project site is served at https://<owner>.github.io/huo/,
// so static assets must be referenced under the /huo/ base path.
export default defineConfig({
  base: '/huo/',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  test: {
    environment: 'node',
    include: ['test/**/*.test.js', 'src/**/*.test.js'],
  },
})
