import { defineConfig } from '@playwright/test';
import { BENCH_PROFILES } from './src/config/budgets';
import { chromiumArgs, chromiumExecutable } from './tests/support/browser';

const PORT = 4180;
const MINUTE_MS = 60_000;
const executablePath = chromiumExecutable();
const profile = process.env.GEOFRONT_GPU === 'hardware' ? 'hardware' : 'software';
const { viewportWidthPx, viewportHeightPx } = BENCH_PROFILES[profile];

/**
 * pnpm bench: serves the bench build (vite build --mode bench) and flies the route on
 * both backends, merging per-zone frame times into bench/results.json.
 */
export default defineConfig({
  testDir: 'tests/bench',
  timeout: 15 * MINUTE_MS,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  metadata: { profile },
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: viewportWidthPx, height: viewportHeightPx },
    headless: process.env.GEOFRONT_HEADED !== '1',
    launchOptions: { args: chromiumArgs(), ...(executablePath ? { executablePath } : {}) },
  },
  projects: [
    // WebGPU needs a headed browser to present on SwiftShader (scripts/with-display.ts).
    { name: 'webgpu' },
    // WebGL 2 runs headless so it stays on ANGLE/SwiftShader rather than the X server's GL.
    { name: 'webgl2', use: { headless: true } },
  ],
  webServer: {
    command: `pnpm exec vite preview --mode bench --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 2 * MINUTE_MS,
  },
});
