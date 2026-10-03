import { defineConfig } from '@playwright/test';
import { chromiumArgs, chromiumExecutable } from './tests/support/browser';

const PORT = 4180;
const MINUTE_MS = 60_000;
const executablePath = chromiumExecutable();

/**
 * pnpm bench: serves the bench build (vite build --mode bench) and flies the
 * route headless, writing bench/results.json. Viewport is the desktop reference.
 */
export default defineConfig({
  testDir: 'tests/bench',
  timeout: 15 * MINUTE_MS,
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    launchOptions: { args: chromiumArgs(), ...(executablePath ? { executablePath } : {}) },
  },
  webServer: {
    command: `pnpm exec vite preview --mode bench --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    timeout: 2 * MINUTE_MS,
  },
});
