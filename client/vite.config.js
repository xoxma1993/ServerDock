import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: '.',
  build: {
    outDir: resolve(__dirname, '../public'),
    emptyOutDir: true
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:2580',
        changeOrigin: true
      },
      '/ws': {
        target: 'ws://localhost:2580',
        ws: true
      }
    }
  }
});

