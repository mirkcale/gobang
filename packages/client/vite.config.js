import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react({
    jsxRuntime: 'classic',
  })],
  root: '.',
  server: {
    port: 3000,
    open: true,
    // SPA fallback: redirect all 404s to index.html
    historyApiFallback: true,
  },
  build: {
    outDir: 'build',
  },
  define: {
    'process.env': process.env,
  },
});