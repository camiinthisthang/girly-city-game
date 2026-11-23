import { defineConfig } from 'vite';

export default defineConfig({
  server: { host: true, port: 5173, allowedHosts: true, proxy: { '/ws': { target: 'ws://localhost:3000', ws: true } } },
  build: { chunkSizeWarningLimit: 2000, target: 'es2022' },
});
