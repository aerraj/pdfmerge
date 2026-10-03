import { DEV_HOOKS_GLOBAL } from '../../src/dev/devHooks';
import { DEV_OVERLAY_MARKER } from '../../src/dev/devOverlay';
import { BENCH_GLOBAL } from '../../src/dev/bench/benchTypes';
import { DEV_SCENE_MARKER } from '../../src/dev/scenes/depthTestLayout';

/** Strings that only exist in developer-only modules; none may appear in dist/. */
export const DEV_MARKERS: readonly string[] = [DEV_OVERLAY_MARKER, BENCH_GLOBAL, DEV_HOOKS_GLOBAL, DEV_SCENE_MARKER];
