import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { BENCH, FRAME_BUDGET } from '../../src/config/budgets';
import { BENCH_GLOBAL, type BenchReport } from '../../src/dev/bench/benchTypes';

const RESULTS_PATH = resolve(import.meta.dirname, '../../bench/results.json');
const MS_PER_SEC = 1000;

test('route bench stays within the frame budget', async ({ page }) => {
  test.setTimeout(BENCH.timeoutSec * MS_PER_SEC);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto('/');
  await page.waitForFunction(
    (key) => {
      const r = (window as unknown as Record<string, BenchReport | undefined>)[key];
      return r?.state === 'done' || r?.state === 'error';
    },
    BENCH_GLOBAL,
    { timeout: BENCH.timeoutSec * MS_PER_SEC, polling: MS_PER_SEC },
  );
  const report = await page.evaluate(
    (key) => (window as unknown as Record<string, BenchReport | undefined>)[key],
    BENCH_GLOBAL,
  );
  if (!report) throw new Error('bench report missing from the page');

  const budget = FRAME_BUDGET.desktop;
  const verdicts = report.segments.map((s) => ({
    id: s.id,
    ...s.summary,
    maxDrawCalls: s.maxDrawCalls,
    maxTriangles: s.maxTriangles,
    withinBudget: s.summary.p99Ms <= budget.p99Ms && s.summary.hitches === 0,
  }));
  mkdirSync(dirname(RESULTS_PATH), { recursive: true });
  writeFileSync(
    RESULTS_PATH,
    `${JSON.stringify({ generatedAt: new Date().toISOString(), tier: 'desktop', budget: { ...budget, hitchMs: FRAME_BUDGET.hitchMs }, renderer: report.renderer, viewport: report.viewport, segments: verdicts }, null, 2)}\n`,
  );

  expect(errors, 'page errors during the bench').toEqual([]);
  expect(report.state, report.error ?? '').toBe('done');
  expect(report.segments.length).toBeGreaterThan(0);
  for (const v of verdicts) {
    expect.soft(v.p99Ms, `${v.id}: p99 frame time (ms)`).toBeLessThanOrEqual(budget.p99Ms);
    expect.soft(v.hitches, `${v.id}: frames over ${FRAME_BUDGET.hitchMs} ms`).toBe(0);
  }
});
