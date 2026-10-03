import { defineConfig } from '@playwright/test';
import { chromiumArgs, chromiumExecutable } from './tests/support/browser';

const PORT = 5180;
const MINUTE_MS = 60_000;
const executablePath = chromiumExecutable();

/** Functional end-to-end tests against the dev server (dev hooks available). */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 3 * MINUTE_MS,
  expect: { timeout: MINUTE_MS },
  fullyParallel: false,
  // Software rendering saturates the CPU; parallel workers would distort timings.
  workers: 1,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1280, height: 720 },
    headless: process.env.GEOFRONT_HEADED !== '1',
    launchOptions: { args: chromiumArgs(), ...(executablePath ? { executablePath } : {}) },
    trace: 'retain-on-failure',
  },
  webServer: {
    command: `pnpm exec vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 2 * MINUTE_MS,
    stdout: 'pipe',
  },
});
