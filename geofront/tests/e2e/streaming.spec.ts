import { expect, test, type Page } from '@playwright/test';
import { BENCH_PROFILES, FRAME_BUDGET } from '../../src/config/budgets';
import { ZONE_ROUTE } from '../../src/config/world';
import type { ZoneId } from '../../src/contracts/manifest';
import type { DevHooks, MemoryReport } from '../../src/dev/devHooks';
import { chromiumArgs, chromiumExecutable } from '../support/browser';

const LOOPS = 3;
const SETTLE_FRAMES = 20;
const MINUTE_MS = 60_000;
/** JS heap may wobble with GC timing; growth beyond this across loops is a leak, bytes. */
const HEAP_SLACK_BYTES = 4 * 1024 * 1024;

const executablePath = chromiumExecutable();
test.use({
  // Software profile viewport (DECISIONS D-018): measures streaming cost, not fill rate.
  viewport: { width: BENCH_PROFILES.software.viewportWidthPx, height: BENCH_PROFILES.software.viewportHeightPx },
  launchOptions: { args: [...chromiumArgs(), '--js-flags=--expose-gc'], ...(executablePath ? { executablePath } : {}) },
});

const hooks = (page: Page) => ({
  goTo: (id: ZoneId) =>
    page.evaluate((zone) => {
      (window as unknown as { __GEOFRONT__: DevHooks }).__GEOFRONT__.getState().setZone(zone);
    }, id),
  /** Waits until the zone and its prefetched successor are ready, then lets frames settle. */
  settle: async (id: ZoneId) => {
    const next = ZONE_ROUTE[ZONE_ROUTE.indexOf(id) + 1] ?? null;
    await page.waitForFunction(
      ([zone, following]) => {
        const h = (window as unknown as { __GEOFRONT__?: DevHooks }).__GEOFRONT__;
        const status = h?.getState().zoneStatus;
        return status?.[zone] === 'ready' && (following === null || status[following] === 'ready');
      },
      [id, next] as const,
      { timeout: MINUTE_MS },
    );
    const start = await page.evaluate(() => (window as unknown as { __GEOFRONT__: DevHooks }).__GEOFRONT__.framesRendered());
    await page.waitForFunction(
      (target) => (window as unknown as { __GEOFRONT__: DevHooks }).__GEOFRONT__.framesRendered() > target,
      start + SETTLE_FRAMES,
    );
  },
  memoryAfterGc: () =>
    page.evaluate(async () => {
      const w = window as unknown as { __GEOFRONT__: DevHooks; gc?: () => void };
      w.gc?.();
      await new Promise((r) => setTimeout(r, 200));
      w.gc?.();
      return w.__GEOFRONT__.memory();
    }),
});

test('zone streaming: memory stays flat over three loops and transitions never hitch (T1.3)', async ({ page }) => {
  test.setTimeout(10 * MINUTE_MS);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  const h = hooks(page);
  await page.goto('/');
  await h.settle('z1-surface');
  await page.evaluate(() => {
    (window as unknown as { __GEOFRONT__: DevHooks }).__GEOFRONT__.startFrameLog();
  });

  const memory: MemoryReport[] = [];
  for (let loop = 0; loop < LOOPS; loop++) {
    for (const id of ZONE_ROUTE) {
      await h.goTo(id);
      await h.settle(id);
      const held = await page.evaluate(() => Object.keys((window as unknown as { __GEOFRONT__: DevHooks }).__GEOFRONT__.getState().zoneStatus));
      expect(held.length, `zones held while in ${id}: ${held.join(', ')}`).toBeLessThanOrEqual(3);
    }
    await h.goTo('z1-surface');
    await h.settle('z1-surface');
    memory.push(await h.memoryAfterGc());
  }

  const { frames, cpu } = await page.evaluate(() => {
    const h = (window as unknown as { __GEOFRONT__: DevHooks }).__GEOFRONT__;
    const cpuLog = h.takeCpuLog();
    return { cpu: cpuLog, frames: h.takeFrameLog() };
  });
  const worst = Math.max(...frames);
  const worstCpu = Math.max(...cpu);
  const [first, second, third] = memory;
  expect(errors).toEqual([]);
  expect(first && second && third).toBeTruthy();
  if (!first || !second || !third) return;
  expect(second.geometries).toBe(first.geometries);
  expect(third.geometries).toBe(first.geometries);
  expect(third.textures).toBe(first.textures);
  expect(third.gpuBytes).toBe(first.gpuBytes);
  if (first.jsHeapBytes > 0) expect(third.jsHeapBytes).toBeLessThan(first.jsHeapBytes + HEAP_SLACK_BYTES);
  // Main-thread work per frame is what the code controls, so it is gated everywhere.
  expect(worstCpu, `worst main-thread frame over ${cpu.length} frames (ms)`).toBeLessThanOrEqual(FRAME_BUDGET.hitchMs);
  // Frame intervals include GPU work; without a GPU, SwiftShader JIT stalls make them
  // meaningless, so they gate only on real hardware (DECISIONS D-025).
  if (process.env.GEOFRONT_GPU === 'hardware') {
    expect(worst, `worst frame over ${frames.length} frames across ${LOOPS} loops (ms)`).toBeLessThanOrEqual(FRAME_BUDGET.hitchMs);
  }
  console.log(
    `[streaming] ${frames.length} frames; worst interval ${worst.toFixed(1)} ms, worst main-thread ${worstCpu.toFixed(1)} ms; memory per loop`,
    JSON.stringify(memory),
  );
});
