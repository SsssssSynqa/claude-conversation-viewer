import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

const productionCsp = {
  name: 'production-csp',
  apply: 'build',
  transformIndexHtml(html) {
    return html.replace(
      "connect-src 'self' ws://127.0.0.1:* ws://localhost:*;",
      "connect-src 'self';",
    );
  },
};

export default defineConfig({
  base: './',
  plugins: [productionCsp, viteSingleFile()],
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: Infinity,
  },
});
