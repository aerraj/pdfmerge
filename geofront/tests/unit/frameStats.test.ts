import { describe, expect, it } from 'vitest';
import { percentile, summarizeFrames } from '../../src/core/frameStats';

describe('frame statistics', () => {
  it('uses nearest-rank percentiles', () => {
    const sorted = Array.from({ length: 100 }, (_, i) => i + 1);
    expect(percentile(sorted, 50)).toBe(50);
    expect(percentile(sorted, 99)).toBe(99);
    expect(percentile(sorted, 100)).toBe(100);
    expect(percentile([], 99)).toBe(0);
  });

  it('summarises frame durations and counts hitches', () => {
    const frames = [...Array<number>(98).fill(16.7), 17.5, 60];
    const s = summarizeFrames(frames, 50);
    expect(s.frames).toBe(100);
    expect(s.p50Ms).toBeCloseTo(16.7);
    expect(s.p99Ms).toBeCloseTo(17.5);
    expect(s.maxMs).toBe(60);
    expect(s.hitches).toBe(1);
  });

  it('handles an empty run', () => {
    expect(summarizeFrames([])).toMatchObject({ frames: 0, meanMs: 0, maxMs: 0, hitches: 0 });
  });
});
