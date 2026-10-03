import { expect, test } from '@playwright/test';
import type { DevHooks } from '../../src/dev/devHooks';

const SETTLE_FRAMES = 10;

test('app boots to a full-screen canvas with nothing drawn over it', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(err.message));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('/');
  // The renderer initialises asynchronously; R3F sizes the canvas once it exists.
  await page.waitForFunction((frames) => {
    const hooks = (window as unknown as { __GEOFRONT__?: DevHooks }).__GEOFRONT__;
    return !!hooks && hooks.getState().renderer !== null && hooks.framesRendered() > frames;
  }, SETTLE_FRAMES);

  const canvas = page.locator('canvas');
  await expect(canvas).toHaveCount(1);
  const box = await canvas.boundingBox();
  const viewport = page.viewportSize();
  expect(box?.width).toBe(viewport?.width);
  expect(box?.height).toBe(viewport?.height);

  // No non-diegetic text anywhere in the document.
  const visibleText = await page.evaluate(() => document.body.innerText.trim());
  expect(visibleText).toBe('');
  expect(errors).toEqual([]);
});
