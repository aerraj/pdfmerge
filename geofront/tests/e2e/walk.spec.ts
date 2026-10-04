import { expect, test } from '@playwright/test';
import { BENCH_PROFILES } from '../../src/config/budgets';
import { WALK } from '../../src/config/movement';
import type { ZoneId } from '../../src/contracts/manifest';
import type { WalkOptions, WalkResult, Waypoint } from '../../src/dev/autopilot';
import type { DevHooks } from '../../src/dev/devHooks';
import { ZONE_ROUTES } from '../../src/dev/routes';

/**
 * T1.4 acceptance: Shinji walks every zone of the route, through its POIs to its exit,
 * without falling through anything or getting stuck. Waypoints are contract node names,
 * so the same test keeps working when approved art replaces the placeholders.
 */
const ROUTES: Record<ZoneId, { nodes: readonly string[]; timeScale: number; arriveM?: number }> = {
  'z1-surface': { nodes: ZONE_ROUTES['z1-surface'], timeScale: 8 },
  // The shaft and the viaduct are ridden in the experience; walking them proves the collision.
  // Waypoints there are about a kilometre apart, so a faster clock and a wider arrival circle.
  'z2-descent': { nodes: ZONE_ROUTES['z2-descent'], timeScale: 32, arriveM: 1.5 },
  'z3-cavern': { nodes: ZONE_ROUTES['z3-cavern'], timeScale: 32, arriveM: 1.5 },
  'z4-pyramid': { nodes: ZONE_ROUTES['z4-pyramid'], timeScale: 8 },
  'z5-corridors': { nodes: ZONE_ROUTES['z5-corridors'], timeScale: 8 },
  'z7-cage': { nodes: ZONE_ROUTES['z7-cage'], timeScale: 8 },
  'z6-command': { nodes: ZONE_ROUTES['z6-command'], timeScale: 8 },
};

const OPTIONS: WalkOptions = { arriveM: 0.6, stuckSec: 6, stuckProgressM: 0.3 };
/** Stepping off a kerb or a stair is fine; anything more is a fall, m. */
const MAX_FALL_M = WALK.maxStepM * 2;
const MINUTE_MS = 60_000;

test.use({ viewport: { width: BENCH_PROFILES.software.viewportWidthPx, height: BENCH_PROFILES.software.viewportHeightPx } });

for (const [zone, route] of Object.entries(ROUTES) as [ZoneId, (typeof ROUTES)[ZoneId]][]) {
  test(`${zone}: Shinji walks the route without falling or getting stuck (T1.4)`, async ({ page }) => {
    test.setTimeout(3 * MINUTE_MS);
    const errors: string[] = [];
    page.on('pageerror', (err) => errors.push(err.message));
    // WebGL keeps SwiftShader at a steady frame rate, which keeps simulated time smooth.
    await page.goto(`/?backend=webgl&zone=${zone}`);
    await page.waitForFunction(() => (window as unknown as { __GEOFRONT__?: DevHooks }).__GEOFRONT__?.player().ready === true, null, { timeout: MINUTE_MS });

    const spawn = await page.evaluate(() => (window as unknown as { __GEOFRONT__: DevHooks }).__GEOFRONT__.player());
    expect(spawn.grounded, 'Shinji stands on the floor at spawn').toBe(true);

    const result: WalkResult = await page.evaluate(
      async ({ id, nodes, timeScale, options }) => {
        const h = (window as unknown as { __GEOFRONT__: DevHooks }).__GEOFRONT__;
        const points = h.zonePoints(id);
        if (!points) throw new Error(`zone ${id} is not loaded`);
        const waypoints: Waypoint[] = nodes.map((name) => {
          const p = points[name];
          if (!p) throw new Error(`${id} has no node ${name}`);
          return { name, x: p[0], y: p[1], z: p[2], kind: name.startsWith('TRG_') ? 'trigger' : 'point' };
        });
        h.setTimeScale(timeScale);
        return h.walk(waypoints, options);
      },
      { id: zone, nodes: [...route.nodes], timeScale: route.timeScale, options: { ...OPTIONS, arriveM: route.arriveM ?? OPTIONS.arriveM } },
    );

    expect(result.failedAt, `${result.reason ?? ''} after ${result.reached.join(' → ')}`).toBeNull();
    expect(result.reached).toEqual([...route.nodes]);
    expect(result.respawns).toBe(0);
    expect(result.worstFallM).toBeLessThan(MAX_FALL_M);
    if (route.nodes.at(-1)?.startsWith('TRG_')) {
      const now = await page.evaluate(() => (window as unknown as { __GEOFRONT__: DevHooks }).__GEOFRONT__.getState().zone);
      expect(now, 'the exit trigger moves Shinji into the next zone').not.toBe(zone);
    }
    expect(errors).toEqual([]);
  });
}
