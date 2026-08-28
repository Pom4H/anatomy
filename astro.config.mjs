import { defineConfig } from 'astro/config';

export default defineConfig({
  site: 'https://pom4h.github.io',
  base: '/anatomy',
  output: 'static',
  trailingSlash: 'always',
  compressHTML: true,
  devToolbar: { enabled: false },
  build: { format: 'directory' },
});
