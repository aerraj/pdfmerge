import { describe, expect, it } from 'vitest';
import { summarizeFrames } from '../../src/core/frameStats';
import type { BenchSegment } from '../../src/dev/bench/benchTypes';
import { budgetFailures } from '../../src/dev/bench/verdict';

const smooth = Array<number>(600).fill(16.7);
const light = Array<number>(600).fill(2);

function segment(overrides: Partial<BenchSegment> = {}): BenchSegment {
  return {
    id: 'z3-cavern',
    summary: summarizeFrames(smooth),
    cpu: summarizeFrames(light),
    maxDrawCalls: 40,
    maxTriangles: 20_000,
    readyOnArrival: true,
    ...overrides,
  };
}

describe('bench verdict (T1.5)', () => {
  it('passes a zone inside the budget', () => {
    expect(budgetFailures(segment(), 'hardware')).toEqual([]);
  });

  it('fails a zone whose main-thread p99 is over 18 ms, on any machine', () => {
    const slow = segment({ cpu: summarizeFrames([...Array<number>(590).fill(2), ...Array<number>(10).fill(25)]) });
    expect(budgetFailures(slow, 'software')).toEqual(['z3-cavern: main-thread p99 25.0 ms > 18 ms']);
  });

  it('fails a single main-thread hitch over 50 ms', () => {
    const hitch = segment({ cpu: summarizeFrames([...light, 80]) });
    expect(budgetFailures(hitch, 'software')[0]).toMatch(/1 main-thread frame\(s\) over 50 ms/);
  });

  it('fails draw calls and triangles at or over the budget', () => {
    const heavy = segment({ maxDrawCalls: 300, maxTriangles: 2_000_000 });
    expect(budgetFailures(heavy, 'software')).toHaveLength(2);
  });

  it('fails a zone the streamer had not loaded in time', () => {
    expect(budgetFailures(segment({ readyOnArrival: false }), 'software')).toEqual(['z3-cavern: not streamed in when the route reached it']);
  });

  it('gates frame intervals on hardware runs only', () => {
    const janky = segment({ summary: summarizeFrames([...smooth, 120]) });
    expect(budgetFailures(janky, 'software')).toEqual([]);
    expect(budgetFailures(janky, 'hardware')).toEqual(['z3-cavern: 1 frame(s) over 50 ms']);
  });
});
