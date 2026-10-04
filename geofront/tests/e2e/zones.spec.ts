import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from '@playwright/test';
import { PNG } from 'pngjs';
import { ZONE_ROUTE } from '../../src/config/world';
import { ZoneManifestSchema } from '../../src/contracts/manifest';
import type { DevHooks, ZoneReport } from '../../src/dev/devHooks';

const SETTLE_FRAMES = 10;
const PUBLIC = resolve(import.meta.dirname, '../../public');

/** Standard deviation of luminance: a blank or single-colour frame scores near zero. */
function luminanceSpread(png: PNG): number {
  let sum = 0;
  let sumSq = 0;
  const n = png.width * png.height;
  for (let i = 0; i < png.data.length; i += 4) {
    const l = 0.2126 * (png.data[i] ?? 0) + 0.7152 * (png.data[i + 1] ?? 0) + 0.0722 * (png.data[i + 2] ?? 0);
    sum += l;
    sumSq += l * l;
  }
  const mean = sum / n;
  return Math.sqrt(sumSq / n - mean * mean);
}

test.describe('placeholder zones (T1.2)', () => {
  for (const id of ZONE_ROUTE) {
    test(`${id} loads with collision floors, POIs and its trigger in place`, async ({ page }) => {
      const manifest = ZoneManifestSchema.parse(JSON.parse(readFileSync(resolve(PUBLIC, 'zones', id, 'manifest.json'), 'utf8')));
      const errors: string[] = [];
      page.on('pageerror', (err) => errors.push(err.message));
      await page.goto(`/?devScene=zone&zone=${id}`);
      await page.waitForFunction((frames) => {
        const hooks = (window as unknown as { __GEOFRONT__?: DevHooks }).__GEOFRONT__;
        return !!hooks?.zone && hooks.framesRendered() > frames;
      }, SETTLE_FRAMES);
      const report: ZoneReport | null = await page.evaluate(() => (window as unknown as { __GEOFRONT__: DevHooks }).__GEOFRONT__.zone);
      if (!report) throw new Error('zone report missing');

      expect(report.error).toBeUndefined();
      expect(report.id).toBe(id);
      const colliders = report.colliders ?? [];
      expect(colliders.length).toBeGreaterThan(0);
      expect(colliders.every((c) => c.triangles > 0)).toBe(true);
      for (const poi of manifest.pois) expect(report.pois).toContain(poi.node);
      if (manifest.transition) expect(report.triggers).toContain(manifest.transition.triggerNode);

      const png = PNG.sync.read(await page.screenshot());
      expect(luminanceSpread(png), 'the spawn view should show geometry, not a blank frame').toBeGreaterThan(8);
      expect(errors).toEqual([]);
    });
  }
});
