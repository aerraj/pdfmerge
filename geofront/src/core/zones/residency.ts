import type { ZoneId } from '../../contracts/manifest';

export interface Residency {
  /** Zones allowed to stay in memory: the previous, current and next zone. */
  keep: ReadonlySet<ZoneId>;
  /** Zones to load, in priority order: the current zone, then the next one (prefetch). */
  load: readonly ZoneId[];
}

/**
 * Streaming policy (design doc, "Zone streaming"): keep the current zone, prefetch the
 * next, keep the previous one until the visitor is two steps past it, dispose the rest.
 * The previous zone is never loaded on demand, only kept.
 */
export function planResidency(route: readonly ZoneId[], current: ZoneId): Residency {
  const i = route.indexOf(current);
  if (i < 0) throw new Error(`GeoFront: zone ${current} is not on the route`);
  const prev = route[i - 1];
  const next = route[i + 1];
  const keep = new Set<ZoneId>([current]);
  if (prev) keep.add(prev);
  if (next) keep.add(next);
  return { keep, load: next ? [current, next] : [current] };
}

/** Zones to draw: the current zone plus whichever of its `alsoVisible` neighbours are ready. */
export function planVisibility(current: ZoneId, alsoVisible: readonly ZoneId[], ready: ReadonlySet<ZoneId>): Set<ZoneId> {
  const visible = new Set<ZoneId>();
  if (ready.has(current)) visible.add(current);
  for (const id of alsoVisible) if (ready.has(id)) visible.add(id);
  return visible;
}
