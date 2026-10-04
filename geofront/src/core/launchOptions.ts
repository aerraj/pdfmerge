import { RENDERER } from '../config/render';
import { ZONE_ROUTE } from '../config/world';
import type { ZoneId } from '../contracts/manifest';

export type BackendChoice = (typeof RENDERER)['backend'];
export type DepthChoice = (typeof RENDERER)['depth'];

export interface LaunchOptions {
  backend: BackendChoice;
  depth: DepthChoice;
  /** Developer scene to show instead of the experience (dev builds only). */
  devScene: string | null;
  /** Zone to start in (dev and bench builds only; production always starts at the street). */
  startZone: ZoneId | null;
}

function pick<T extends string>(value: string | null, allowed: readonly T[]): T | undefined {
  return allowed.find((a) => a === value);
}

/**
 * Launch options from the URL. `?backend=webgl|webgpu` works in every build (it helps
 * diagnose a device without any UI); depth and dev-scene overrides exist only in dev.
 */
export function readLaunchOptions(search: string = window.location.search): LaunchOptions {
  const params = new URLSearchParams(search);
  const dev = import.meta.env.DEV;
  return {
    backend: pick(params.get('backend'), ['auto', 'webgpu', 'webgl'] as const) ?? RENDERER.backend,
    depth: (dev ? pick(params.get('depth'), ['reversed', 'logarithmic', 'standard'] as const) : undefined) ?? RENDERER.depth,
    devScene: dev ? params.get('devScene') : null,
    startZone: dev || import.meta.env.MODE === 'bench' ? (pick(params.get('zone'), ZONE_ROUTE) ?? null) : null,
  };
}
