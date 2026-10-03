import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// Ports are fixed so Playwright configs can rely on them.
const DEV_PORT = 5173;
const PREVIEW_PORT = 4173;

export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2023',
    sourcemap: true,
    reportCompressedSize: false,
  },
  server: { port: DEV_PORT, strictPort: true },
  preview: { port: PREVIEW_PORT, strictPort: true },
});
