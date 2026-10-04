/**
 * Performance and smoothness budgets (design doc, "Performance budget").
 * Source tags as in scale.ts. Limits the doc states as "under N" are strict: value < N.
 */

/** Frame-time budgets per quality tier. */
export const FRAME_BUDGET = {
  desktop: {
    /** Target refresh rate, fps. [doc] "Holds a locked 60 fps on a laptop with integrated graphics". */
    targetFps: 60,
    /** 99th-percentile frame time ceiling, ms. [doc] "p99 frame time at or under 18 ms on desktop". */
    p99Ms: 18,
  },
  mobile: {
    /** Target refresh rate, fps. [doc] "30 fps on a recent mid-range phone". */
    targetFps: 30,
    /** 99th-percentile frame time ceiling, ms. [doc] "36 ms on mobile". */
    p99Ms: 36,
  },
  /** No frame anywhere in a run may exceed this, ms. [doc] "zero frames over 50 ms anywhere in the run". */
  hitchMs: 50,
} as const;

/** Per-frame and per-download limits per quality tier. */
export const RENDER_BUDGET = {
  desktop: {
    /** Draw calls per frame, strict upper bound, count. [doc] "under 300". */
    drawCalls: 300,
    /** Visible triangles per frame, strict upper bound, count. [doc] "under 2 million". */
    triangles: 2_000_000,
    /** GPU memory, strict upper bound, MB. [doc] "under 1.5 GB". */
    gpuMemoryMb: 1536,
    /** Download before the first frame, strict upper bound, MB. [doc] "under 15 MB". */
    initialDownloadMb: 15,
    /** Largest single zone download, strict upper bound, MB. [doc] "under 40 MB". */
    largestZoneMb: 40,
  },
  mobile: {
    /** Draw calls per frame, strict upper bound, count. [doc] "under 150". */
    drawCalls: 150,
    /** Visible triangles per frame, strict upper bound, count. [doc] "under 500,000". */
    triangles: 500_000,
    /** GPU memory, strict upper bound, MB. [doc] "under 500 MB". */
    gpuMemoryMb: 500,
    /** Download before the first frame, strict upper bound, MB. [doc] "under 8 MB". */
    initialDownloadMb: 8,
    /** Largest single zone download (reduced textures), strict upper bound, MB. [doc] "under 20 MB". */
    largestZoneMb: 20,
  },
} as const;

/** Characters on screen. */
export const CHARACTER_BUDGET = {
  /** Skinned meshes visible at once, count. [doc] "at most 8 skinned meshes on screen at once". */
  maxSkinnedMeshes: 8,
} as const;

/** Loading. */
export const LOAD_BUDGET = {
  /** Time to first frame on the reference connection, s. [doc] "under 5 seconds on a 50 Mbps connection". */
  firstFrameSec: 5,
  /** Reference connection for the first-frame target, Mbps. [doc] */
  referenceBandwidthMbps: 50,
} as const;

/** Main-thread work slicing for streaming, so loading never causes a hitch. */
export const STREAMING_BUDGET = {
  /** Main-thread time a streaming job may use per frame, ms. [tuned] leaves headroom inside a 16.7 ms frame. */
  sliceMs: 4,
  /** Web workers decoding Meshopt geometry off the main thread, count. [tuned] */
  decoderWorkers: 2,
} as const;

/** Frame statistics collection. */
export const FRAME_STATS = {
  /** Frames kept in the rolling window used by the dev overlay, frames. [tuned] 4 s at 60 fps. */
  rollingWindowFrames: 240,
  /** Dev overlay refresh interval, ms. [tuned] */
  overlayRefreshMs: 250,
} as const;

/**
 * Bench viewports. "hardware" is the reference laptop (GEOFRONT_GPU=hardware pnpm bench).
 * "software" is any machine without a GPU (containers, CI), where SwiftShader rasterises
 * on the CPU: the small viewport keeps fill rate from swamping the run, so the software
 * bench gates CPU cost, streaming hitches, draw calls and triangles, not GPU fill rate
 * (DECISIONS D-018).
 */
export const BENCH_PROFILES = {
  hardware: {
    /** Viewport width, px. [doc] desktop renders at native resolution; 1080p laptop panel. */
    viewportWidthPx: 1920,
    /** Viewport height, px. [doc] */
    viewportHeightPx: 1080,
  },
  software: {
    /** Viewport width, px. [tuned] largest size at which SwiftShader WebGPU holds 60 fps on an empty frame. */
    viewportWidthPx: 640,
    /** Viewport height, px. [tuned] */
    viewportHeightPx: 360,
  },
} as const;

/** Benchmark run parameters (pnpm bench). */
export const BENCH = {
  /** Frames ignored after the experience starts while the first frames settle, frames. [tuned] */
  warmupFrames: 30,
  /** Duration of the boot segment (first zone, standing at spawn), s. [tuned] */
  bootSegmentSec: 6,
  /** Route flight speed, m/s. [tuned] faster than walking so the run stays short. */
  flightSpeedMps: 12,
  /** Shortest flight through one zone, s. [tuned] enough frames to measure each zone. */
  flightMinZoneSec: 8,
  /** Longest flight through one zone, s. [tuned] keeps the whole run short. */
  flightMaxZoneSec: 20,
  /** Longest pause at a point of interest during the flight, s. [tuned] */
  flightMaxLingerSec: 1.5,
  /** Half-life of the flight camera's turn towards its direction of travel, s. [tuned] */
  flightLookHalfLifeSec: 0.35,
  /** Steepest flight camera pitch, deg. [tuned] */
  flightMaxPitchDeg: 30,
  /** Hard ceiling on a whole bench run before it is declared hung, s. [tuned] */
  timeoutSec: 600,
} as const;
