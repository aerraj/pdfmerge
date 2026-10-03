import type { FrameSummary } from '../../core/frameStats';

/** One measured stretch of the bench run (a zone, or the boot segment). */
export interface BenchSegment {
  id: string;
  summary: FrameSummary;
  maxDrawCalls: number;
  maxTriangles: number;
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
