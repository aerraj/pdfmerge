import { DEV_OVERLAY_MARKER } from '../../src/dev/devOverlay';
import { BENCH_GLOBAL } from '../../src/dev/bench/benchTypes';

/** Strings that only exist in developer-only modules; none may appear in dist/. */
export const DEV_MARKERS: readonly string[] = [DEV_OVERLAY_MARKER, BENCH_GLOBAL];
