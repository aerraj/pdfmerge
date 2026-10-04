import type { FrameSummary } from '../../core/frameStats';

/** One measured stretch of the bench run: the boot, a zone of the route, or the whole route. */
export interface BenchSegment {
  id: string;
  /** Intervals between presented frames: what the visitor sees. */
  summary: FrameSummary;
  /** Main-thread time per frame: what the code costs, independent of the GPU. */
  cpu: FrameSummary;
  maxDrawCalls: number;
  maxTriangles: number;
  /** For zone segments: whether the zone had finished streaming when the flight reached it. */
  readyOnArrival?: boolean;
  /** For zone segments: time spent waiting for it to finish streaming, ms. */
  waitMs?: number;
}

export interface BenchReport {
  state: 'running' | 'done' | 'error';
  error?: string;
  /** Renderer backend and GPU string, so results can be interpreted. */
  renderer: string;
  viewport: { width: number; height: number; devicePixelRatio: number };
  segments: BenchSegment[];
}

export const BENCH_GLOBAL = '__GEOFRONT_BENCH__';
