import { onFrame, summarizeFrames, type FrameSample } from '../../core/frameStats';
import { useGeoStore } from '../../core/store';
import { BENCH_GLOBAL, type BenchReport, type BenchSegment } from './benchTypes';

/** Accumulates frames into a named segment. */
class SegmentRecorder {
  private readonly deltas: number[] = [];
  private readonly cpu: number[] = [];
  private maxDrawCalls = 0;
  private maxTriangles = 0;
  readonly id: string;
  extra: Pick<BenchSegment, 'readyOnArrival' | 'waitMs'> = {};

  constructor(id: string) {
    this.id = id;
  }

  add(sample: FrameSample): void {
    this.deltas.push(sample.deltaMs);
    this.cpu.push(sample.cpuMs);
    this.maxDrawCalls = Math.max(this.maxDrawCalls, sample.drawCalls);
    this.maxTriangles = Math.max(this.maxTriangles, sample.triangles);
  }

  finish(): BenchSegment {
    return {
      id: this.id,
      summary: summarizeFrames(this.deltas),
      cpu: summarizeFrames(this.cpu),
      maxDrawCalls: this.maxDrawCalls,
      maxTriangles: this.maxTriangles,
      ...this.extra,
    };
  }
}

function rendererLabel(): string {
  const status = useGeoStore.getState().renderer;
  return status ? `${status.backend} (${status.depth} depth): ${status.gpu}` : 'unknown';
}

const report: BenchReport = {
  state: 'running',
  renderer: 'pending',
  viewport: { width: 0, height: 0, devicePixelRatio: 1 },
  segments: [],
};
let current: SegmentRecorder | null = null;
let route: SegmentRecorder | null = null;

/**
 * Records the bench run. The flight (BenchFlight) opens a segment per zone; every frame
 * lands in the open segment and in the whole-route total.
 */
export const benchRecorder = {
  begin(id: string): void {
    this.end();
    current = new SegmentRecorder(id);
    if (id !== 'boot') route ??= new SegmentRecorder('route');
  },
  annotate(extra: Pick<BenchSegment, 'readyOnArrival' | 'waitMs'>): void {
    if (current) current.extra = { ...current.extra, ...extra };
  },
  end(): void {
    if (current) report.segments.push(current.finish());
    current = null;
  },
  finish(): void {
    this.end();
    if (route) report.segments.push(route.finish());
    report.renderer = rendererLabel();
    report.state = 'done';
  },
  fail(message: string): void {
    report.state = 'error';
    report.error = message;
  },
};

/** Bench-build entry point: publishes the report for the Playwright bench to collect. */
export function installBenchRunner(): void {
  report.viewport = { width: window.innerWidth, height: window.innerHeight, devicePixelRatio: window.devicePixelRatio };
  Object.assign(window, { [BENCH_GLOBAL]: report });
  onFrame((sample) => {
    current?.add(sample);
    if (current && current.id !== 'boot') route?.add(sample);
  });
}
