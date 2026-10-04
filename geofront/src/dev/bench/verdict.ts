import { FRAME_BUDGET, RENDER_BUDGET } from '../../config/budgets';
import type { BenchSegment } from './benchTypes';

export type BenchProfile = 'software' | 'hardware';

/**
 * Why a bench segment breaks the Performance budget (empty when it is within budget).
 * Main-thread time, draw calls, triangles and streaming are gated everywhere; frame
 * intervals only on real GPUs, because SwiftShader's numbers describe SwiftShader (D-025).
 */
export function budgetFailures(s: BenchSegment, profile: BenchProfile): string[] {
  const failures: string[] = [];
  const p99 = FRAME_BUDGET.desktop.p99Ms;
  const hitch = FRAME_BUDGET.hitchMs;
  if (s.cpu.p99Ms > p99) failures.push(`${s.id}: main-thread p99 ${s.cpu.p99Ms.toFixed(1)} ms > ${p99} ms`);
  if (s.cpu.hitches > 0) failures.push(`${s.id}: ${s.cpu.hitches} main-thread frame(s) over ${hitch} ms`);
  if (s.maxDrawCalls >= RENDER_BUDGET.desktop.drawCalls) failures.push(`${s.id}: ${s.maxDrawCalls} draw calls (budget under ${RENDER_BUDGET.desktop.drawCalls})`);
  if (s.maxTriangles >= RENDER_BUDGET.desktop.triangles) failures.push(`${s.id}: ${s.maxTriangles} triangles (budget under ${RENDER_BUDGET.desktop.triangles})`);
  if (s.readyOnArrival === false) failures.push(`${s.id}: not streamed in when the route reached it`);
  if (profile === 'hardware') {
    if (s.summary.p99Ms > p99) failures.push(`${s.id}: frame p99 ${s.summary.p99Ms.toFixed(1)} ms > ${p99} ms`);
    if (s.summary.hitches > 0) failures.push(`${s.id}: ${s.summary.hitches} frame(s) over ${hitch} ms`);
  }
  return failures;
}
