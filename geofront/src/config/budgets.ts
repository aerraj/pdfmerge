/**
 * Performance and smoothness budgets (design doc: "Performance budget").
 * Units are in the constant names: Ms = milliseconds, Sec = seconds.
 */

/** Frame-time budgets per quality tier. Source: design doc, "Smoothness budget (must)". */
export const FRAME_BUDGET = {
  desktop: {
    /** Target refresh, frames per second. */
    targetFps: 60,
    /** 99th-percentile frame time ceiling, ms. */
    p99Ms: 18,
  },
  mobile: {
    targetFps: 30,
    p99Ms: 36,
  },
  /** No frame anywhere in a run may exceed this, ms, on any tier. */
  hitchMs: 50,
} as const;

/** Frame statistics collection. */
export const FRAME_STATS = {
  /** Frames kept in the rolling window used by the dev overlay, frames. */
  rollingWindowFrames: 240,
  /** Dev overlay refresh interval, ms. */
  overlayRefreshMs: 250,
} as const;

/** Benchmark run parameters (pnpm bench). */
export const BENCH = {
  /** Frames ignored after the experience starts, while the first frames settle, frames. */
  warmupFrames: 30,
  /** Duration of the boot/empty-scene segment, seconds. */
  bootSegmentSec: 6,
  /** Hard ceiling on a whole bench run before it is declared hung, seconds. */
  timeoutSec: 600,
} as const;
