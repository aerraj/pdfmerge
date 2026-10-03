import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { BENCH, FRAME_BUDGET, RENDER_BUDGET } from '../../src/config/budgets';
import { BENCH_GLOBAL, type BenchReport } from '../../src/dev/bench/benchTypes';

const RESULTS_PATH = resolve(import.meta.dirname, '../../bench/results.json');
const MS_PER_SEC = 1000;

interface ResultsFile {
  profile: string;
  budget: { p99Ms: number; hitchMs: number; drawCalls: number; triangles: number };
  runs: Record<string, unknown>;
}

function mergeResults(profile: string, backend: string, run: unknown) {
  const budget = {
    p99Ms: FRAME_BUDGET.desktop.p99Ms,
    hitchMs: FRAME_BUDGET.hitchMs,
    drawCalls: RENDER_BUDGET.desktop.drawCalls,
    triangles: RENDER_BUDGET.desktop.triangles,
  };
  let file: ResultsFile = { profile, budget, runs: {} };
  if (existsSync(RESULTS_PATH)) {
    const previous = JSON.parse(readFileSync(RESULTS_PATH, 'utf8')) as ResultsFile;
    if (previous.profile === profile) file = { ...previous, budget };
  }
  file.runs[backend] = run;
  mkdirSync(dirname(RESULTS_PATH), { recursive: true });
  writeFileSync(RESULTS_PATH, `${JSON.stringify(file, null, 2)}\n`);
}

test('route stays within the frame and render budgets', async ({ page }, info) => {
  test.setTimeout(BENCH.timeoutSec * MS_PER_SEC);
  const backend = info.project.name;
  const profile = String(info.config.metadata.profile);
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));

  await page.goto(`/?backend=${backend === 'webgl2' ? 'webgl' : 'webgpu'}`);
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

  const p99Budget = FRAME_BUDGET.desktop.p99Ms;
  const segments = report.segments.map((s) => ({
    id: s.id,
    ...s.summary,
    maxDrawCalls: s.maxDrawCalls,
    maxTriangles: s.maxTriangles,
    withinBudget:
      s.summary.p99Ms <= p99Budget &&
      s.summary.hitches === 0 &&
      s.maxDrawCalls < RENDER_BUDGET.desktop.drawCalls &&
      s.maxTriangles < RENDER_BUDGET.desktop.triangles,
  }));
  mergeResults(profile, backend, {
    generatedAt: new Date().toISOString(),
    renderer: report.renderer,
    viewport: report.viewport,
    segments,
  });

  expect(errors, 'page errors during the bench').toEqual([]);
  expect(report.state, report.error ?? '').toBe('done');
  expect(report.renderer.startsWith(backend), `expected the ${backend} backend, got ${report.renderer}`).toBe(true);
  expect(report.segments.length).toBeGreaterThan(0);
  for (const s of segments) {
    expect.soft(s.p99Ms, `${s.id}: p99 frame time (ms)`).toBeLessThanOrEqual(p99Budget);
    expect.soft(s.hitches, `${s.id}: frames over ${FRAME_BUDGET.hitchMs} ms`).toBe(0);
    expect.soft(s.maxDrawCalls, `${s.id}: draw calls`).toBeLessThan(RENDER_BUDGET.desktop.drawCalls);
    expect.soft(s.maxTriangles, `${s.id}: triangles`).toBeLessThan(RENDER_BUDGET.desktop.triangles);
  }
});
