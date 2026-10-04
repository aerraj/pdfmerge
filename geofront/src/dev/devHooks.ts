import { framesRendered } from '../core/frameStats';
import { useGeoStore } from '../core/store';

/** What the zone viewer loaded, for end-to-end checks. */
export interface ZoneReport {
  id: string;
  error?: string;
  colliders?: { name: string; triangles: number }[];
  pois?: string[];
  triggers?: string[];
  screens?: string[];
  lights?: string[];
}

/** Read-only handles for end-to-end tests. Dev builds only. */
export interface DevHooks {
  getState: typeof useGeoStore.getState;
  framesRendered: typeof framesRendered;
  zone: ZoneReport | null;
}

let hooks: DevHooks | null = null;

export function reportZone(report: ZoneReport): void {
  if (hooks) hooks.zone = report;
}

export const DEV_HOOKS_GLOBAL = '__GEOFRONT__';

export function installDevHooks(): void {
  hooks = { getState: useGeoStore.getState, framesRendered, zone: null };
  Object.assign(window, { [DEV_HOOKS_GLOBAL]: hooks });
}
