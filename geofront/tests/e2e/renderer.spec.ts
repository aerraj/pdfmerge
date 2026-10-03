import { expect, test, type Page } from '@playwright/test';
import { PNG } from 'pngjs';
import { DEPTH_TEST_DISTANCES, STRIP_LAYOUT } from '../../src/dev/scenes/depthTestLayout';
import type { DevHooks } from '../../src/dev/devHooks';
import type { RendererStatus } from '../../src/core/store';

type Backend = 'webgl' | 'webgpu';
type Depth = 'reversed' | 'standard';

const SETTLE_FRAMES = 20;

async function openDepthScene(page: Page, backend: Backend, depth: Depth): Promise<{ status: RendererStatus; png: PNG }> {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  await page.goto(`/?devScene=depth&backend=${backend}&depth=${depth}`);
  await page.waitForFunction((frames) => {
    const hooks = (window as unknown as { __GEOFRONT__?: DevHooks }).__GEOFRONT__;
    return !!hooks && hooks.getState().renderer !== null && hooks.framesRendered() > frames;
  }, SETTLE_FRAMES);
  const status = await page.evaluate(() => {
    const hooks = (window as unknown as { __GEOFRONT__: DevHooks }).__GEOFRONT__;
    const renderer = hooks.getState().renderer;
    if (!renderer) throw new Error('renderer missing');
    return renderer;
  });
  const png = PNG.sync.read(await page.screenshot());
  expect(errors).toEqual([]);
  return { status, png };
}

/** Red-dominant pixels inside each strip: the back quad showing through the front one. */
function zFightingPerStrip(png: PNG): number[] {
  const { width, height, data } = png;
  return DEPTH_TEST_DISTANCES.map((_, i) => {
    const centre = STRIP_LAYOUT.firstX + i * STRIP_LAYOUT.stepX;
    const halfWidth = (STRIP_LAYOUT.width / 2) * 0.6; // inner 60 % avoids edge pixels
    const x0 = Math.round(((centre - halfWidth + 1) / 2) * width);
    const x1 = Math.round(((centre + halfWidth + 1) / 2) * width);
    const inset = (STRIP_LAYOUT.topY - STRIP_LAYOUT.bottomY) * 0.2;
    const y0 = Math.round(((1 - (STRIP_LAYOUT.topY - inset)) / 2) * height);
    const y1 = Math.round(((1 - (STRIP_LAYOUT.bottomY + inset)) / 2) * height);
    let red = 0;
    let green = 0;
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const o = (y * width + x) * 4;
        const r = data[o] ?? 0;
        const g = data[o + 1] ?? 0;
        if (r > g + 40) red++;
        else if (g > r + 40) green++;
      }
    }
    expect(red + green, `strip ${i} should be filled by the test quads`).toBeGreaterThan((x1 - x0) * (y1 - y0) * 0.95);
    return red;
  });
}

function meanAbsoluteDifference(a: PNG, b: PNG): number {
  expect(a.width).toBe(b.width);
  expect(a.height).toBe(b.height);
  let sum = 0;
  for (let i = 0; i < a.data.length; i += 4) {
    for (let c = 0; c < 3; c++) sum += Math.abs((a.data[i + c] ?? 0) - (b.data[i + c] ?? 0));
  }
  return sum / ((a.data.length / 4) * 3);
}

test.describe('renderer (T1.1)', () => {
  const shots: Partial<Record<Backend, PNG>> = {};

  for (const backend of ['webgpu', 'webgl'] as const) {
    test(`${backend}: reversed-Z float depth has no z-fighting from 0.15 m to 10 km`, async ({ page }) => {
      const { status, png } = await openDepthScene(page, backend, 'reversed');
      expect(status.backend).toBe(backend === 'webgl' ? 'webgl2' : 'webgpu');
      expect(status.depth).toBe('reversed-float');
      const fighting = zFightingPerStrip(png);
      expect(fighting, `red pixels per strip at ${DEPTH_TEST_DISTANCES.join(', ')} m`).toEqual(DEPTH_TEST_DISTANCES.map(() => 0));
      shots[backend] = png;
    });
  }

  test('both backends render the same image', () => {
    const { webgl, webgpu } = shots;
    test.skip(!webgl || !webgpu, 'needs both backend screenshots from the tests above');
    if (!webgl || !webgpu) return;
    expect(meanAbsoluteDifference(webgl, webgpu)).toBeLessThan(1.5);
  });

  test('control: a standard depth buffer does z-fight at kilometre range', async ({ page }) => {
    const { status, png } = await openDepthScene(page, 'webgl', 'standard');
    expect(status.depth).toBe('standard');
    const fighting = zFightingPerStrip(png);
    const farStrips = fighting.slice(DEPTH_TEST_DISTANCES.indexOf(1000));
    // Proves the test can see z-fighting at all: without reversed-Z the far strips fail.
    expect(farStrips.every((red) => red > 0), `red pixels per strip: ${fighting.join(', ')}`).toBe(true);
  });
});
