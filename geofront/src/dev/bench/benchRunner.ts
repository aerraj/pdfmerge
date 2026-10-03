import { BENCH } from '../../config/budgets';
import { onFrame, summarizeFrames, type FrameSample } from '../../core/frameStats';
import { BENCH_GLOBAL, type BenchReport, type BenchSegment } from './benchTypes';

/** Accumulates frames into a named segment. */
class SegmentRecorder {
  private readonly deltas: number[] = [];
  private maxDrawCalls = 0;
  private maxTriangles = 0;
  readonly id: string;

  constructor(id: string) {
    this.id = id;
  }

  add(sample: FrameSample): void {
    this.deltas.push(sample.deltaMs);
    this.maxDrawCalls = Math.max(this.maxDrawCalls, sample.drawCalls);
    this.maxTriangles = Math.max(this.maxTriangles, sample.triangles);
  }

  get frameCount(): number {
    return this.deltas.length;
  }

  finish(): BenchSegment {
    return {
      id: this.id,
      summary: summarizeFrames(this.deltas),
      maxDrawCalls: this.maxDrawCalls,
      maxTriangles: this.maxTriangles,
    };
  }
}

const MS_PER_SEC = 1000;

function rendererLabel(): string {
  const canvas = document.querySelector('canvas');
  const gl = canvas?.getContext('webgl2');
  if (!gl) return 'unknown';
  const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name: unknown = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER);
  return `webgl2: ${String(name)}`;
}

/**
 * Bench-build entry point. Records frame times for each segment of the run and
 * publishes a BenchReport on window for the Playwright bench to collect.
 */
export function installBenchRunner(): void {
  const report: BenchReport = {
    state: 'running',
    renderer: 'pending',
    viewport: { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio },
    segments: [],
  };
  Object.assign(window, { [BENCH_GLOBAL]: report });

  let warmup: number = BENCH.warmupFrames;
  let segment: SegmentRecorder | null = null;
  let segmentStart = 0;
  const off = onFrame((sample) => {
    if (warmup > 0) {
      warmup -= 1;
      return;
    }
    if (!segment) {
      report.renderer = rendererLabel();
      segment = new SegmentRecorder('boot');
      segmentStart = sample.timeMs;
    }
    segment.add(sample);
    if (sample.timeMs - segmentStart >= BENCH.bootSegmentSec * MS_PER_SEC) {
      report.segments.push(segment.finish());
      report.state = 'done';
      off();
    }
  });
}
