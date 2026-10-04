import { Group } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { ZONE_ROUTE } from '../../src/config/world';
import type { ZoneId } from '../../src/contracts/manifest';
import { planResidency, planVisibility } from '../../src/core/zones/residency';
import type { ZoneContent } from '../../src/core/zones/zoneContent';
import { ZoneStreamer } from '../../src/core/zones/zoneStreamer';

function fakeZone(id: ZoneId, disposed: ZoneId[]): ZoneContent {
  return {
    id,
    manifest: { id, glb: `${id}.glb`, next: null, prev: null, spawn: { position: [0, 0, 0], yawDeg: 0 }, transition: null, ambience: [], pois: [] },
    root: new Group(),
    colliders: [],
    triggers: new Map(),
    pois: new Map(),
    screens: new Map(),
    lights: new Map(),
    dispose: () => disposed.push(id),
  };
}

/** A loader whose loads resolve only when the test says so. */
function controllableLoader(disposed: ZoneId[]) {
  const pending = new Map<ZoneId, () => void>();
  const requested: ZoneId[] = [];
  const loader = (id: ZoneId, signal: AbortSignal) =>
    new Promise<ZoneContent>((resolve, reject) => {
      requested.push(id);
      signal.addEventListener('abort', () => { reject(new DOMException('aborted', 'AbortError')); });
      pending.set(id, () => { resolve(fakeZone(id, disposed)); });
    });
  /** Completes a load once the streamer has asked for it, then lets the streamer react. */
  const finish = async (id: ZoneId) => {
    await vi.waitFor(() => {
      if (!pending.has(id)) throw new Error(`${id} not requested yet`);
    });
    pending.get(id)?.();
    pending.delete(id);
    await new Promise((r) => setTimeout(r, 0));
  };
  return { loader, requested, finish };
}

describe('residency policy', () => {
  it('keeps previous, current and next; loads current then next', () => {
    const plan = planResidency(ZONE_ROUTE, 'z4-pyramid');
    expect([...plan.keep].sort()).toEqual(['z3-cavern', 'z4-pyramid', 'z5-corridors']);
    expect(plan.load).toEqual(['z4-pyramid', 'z5-corridors']);
  });

  it('follows the story order across the cage and command centre', () => {
    expect(planResidency(ZONE_ROUTE, 'z5-corridors').load).toEqual(['z5-corridors', 'z7-cage']);
    expect(planResidency(ZONE_ROUTE, 'z7-cage').load).toEqual(['z7-cage', 'z6-command']);
    expect(planResidency(ZONE_ROUTE, 'z6-command').load).toEqual(['z6-command']);
    expect([...planResidency(ZONE_ROUTE, 'z1-surface').keep].sort()).toEqual(['z1-surface', 'z2-descent']);
  });

  it('shows the current zone and ready alsoVisible neighbours only', () => {
    const ready = new Set<ZoneId>(['z3-cavern', 'z4-pyramid']);
    expect([...planVisibility('z4-pyramid', ['z3-cavern'], ready)].sort()).toEqual(['z3-cavern', 'z4-pyramid']);
    expect([...planVisibility('z4-pyramid', ['z5-corridors'], ready)]).toEqual(['z4-pyramid']);
  });
});

describe('ZoneStreamer', () => {
  it('loads the current zone before prefetching the next', async () => {
    const disposed: ZoneId[] = [];
    const { loader, requested, finish } = controllableLoader(disposed);
    const streamer = new ZoneStreamer(ZONE_ROUTE, loader);
    streamer.setCurrent('z1-surface');
    await new Promise((r) => setTimeout(r, 0));
    expect(requested).toEqual(['z1-surface']);
    await finish('z1-surface');
    expect(requested).toEqual(['z1-surface', 'z2-descent']);
    await finish('z2-descent');
    expect(streamer.status()).toEqual({ 'z1-surface': 'ready', 'z2-descent': 'ready' });
  });

  it('disposes zones two behind and aborts loads that are no longer wanted', async () => {
    const disposed: ZoneId[] = [];
    const { loader, finish } = controllableLoader(disposed);
    const evicted: ZoneId[] = [];
    const streamer = new ZoneStreamer(ZONE_ROUTE, loader, { onEvict: (z) => evicted.push(z.id) });
    streamer.setCurrent('z1-surface');
    await finish('z1-surface');
    await finish('z2-descent');
    streamer.setCurrent('z2-descent');
    await finish('z3-cavern');
    streamer.setCurrent('z3-cavern');
    await new Promise((r) => setTimeout(r, 0)); // let the z4 prefetch start
    // z1 is now two behind.
    expect(disposed).toEqual(['z1-surface']);
    expect(evicted).toEqual(['z1-surface']);
    expect(Object.keys(streamer.status()).sort()).toEqual(['z2-descent', 'z3-cavern', 'z4-pyramid']);
    // Teleport back to the start while z4 is still loading: z4 is aborted, z2 and z3 go.
    streamer.setCurrent('z1-surface');
    expect(disposed).toEqual(['z1-surface', 'z3-cavern']);
    await finish('z1-surface');
    expect(streamer.status()).toEqual({ 'z2-descent': 'ready', 'z1-surface': 'ready' });
  });

  it('reports load errors and forgets the zone so it can be retried', async () => {
    const errors: ZoneId[] = [];
    const streamer = new ZoneStreamer(ZONE_ROUTE, () => Promise.reject(new Error('404')), { onError: (id) => errors.push(id) });
    streamer.setCurrent('z6-command');
    await vi.waitFor(() => {
      expect(errors).toEqual(['z6-command']);
    });
    expect(streamer.status()).toEqual({});
  });
});
