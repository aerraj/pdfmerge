import { FRAME_BUDGET } from '../config/budgets';

/** Summary statistics over a set of frame durations (ms). */
export interface FrameSummary {
  frames: number;
  meanMs: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  maxMs: number;
  /** Frames longer than the hitch threshold (FRAME_BUDGET.hitchMs). */
  hitches: number;
}

const PERCENT = 100;

/** Nearest-rank percentile of an ascending-sorted array. */
export function percentile(sortedAsc: readonly number[], pct: number): number {
  if (sortedAsc.length === 0) return 0;
  const rank = Math.ceil((pct / PERCENT) * sortedAsc.length);
  const index = Math.min(sortedAsc.length - 1, Math.max(0, rank - 1));
  return sortedAsc[index] ?? 0;
}

const P50 = 50;
const P95 = 95;
const P99 = 99;

export function summarizeFrames(durationsMs: readonly number[], hitchMs: number = FRAME_BUDGET.hitchMs): FrameSummary {
  const sorted = [...durationsMs].sort((a, b) => a - b);
  const total = sorted.reduce((sum, v) => sum + v, 0);
  return {
    frames: sorted.length,
    meanMs: sorted.length ? total / sorted.length : 0,
    p50Ms: percentile(sorted, P50),
    p95Ms: percentile(sorted, P95),
    p99Ms: percentile(sorted, P99),
    maxMs: sorted.length ? (sorted[sorted.length - 1] ?? 0) : 0,
    hitches: sorted.filter((v) => v > hitchMs).length,
  };
}

/** Per-frame renderer counters sampled alongside frame time. */
export interface FrameSample {
  /** Timestamp of the frame start, ms (performance.now clock). */
  timeMs: number;
  /** Time since the previous frame, ms. */
  deltaMs: number;
  drawCalls: number;
  triangles: number;
}

type FrameListener = (sample: FrameSample) => void;

const listeners = new Set<FrameListener>();

/** Subscribe to every rendered frame. Returns an unsubscribe function. */
export function onFrame(listener: FrameListener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Called once per rendered frame by the scene's frame probe. */
export function publishFrame(sample: FrameSample): void {
  for (const listener of listeners) listener(sample);
}
