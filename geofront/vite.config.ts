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
  // Pre-bundle heavy deps at startup so the dev server never re-optimises (and reloads
  // the page) the first time a test opens a scene that imports them.
  optimizeDeps: {
    include: ['three', 'three/webgpu', 'three/tsl', 'three/addons/loaders/GLTFLoader.js', 'three/addons/libs/meshopt_decoder.module.js', '@react-three/fiber', 'react', 'react-dom', 'react-dom/client', 'zustand', 'zod'],
  },
  preview: { port: PREVIEW_PORT, strictPort: true },
});
