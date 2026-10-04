import { describe, expect, it } from 'vitest';
import { damp, nearestAngleDeg, stepCriticalSpring, type Spring } from '../../src/camera/springs';

function settle(halfLife: number, dt: number, seconds: number): Spring {
  const s: Spring = { x: 0, v: 0 };
  for (let t = 0; t < seconds; t += dt) stepCriticalSpring(s, 1, halfLife, dt);
  return s;
}

describe('springs', () => {
  it('settles on the target without overshoot', () => {
    const s: Spring = { x: 0, v: 0 };
    let max = 0;
    for (let i = 0; i < 600; i++) {
      stepCriticalSpring(s, 1, 0.1, 1 / 60);
      max = Math.max(max, s.x);
    }
    expect(s.x).toBeCloseTo(1, 6);
    expect(max).toBeLessThanOrEqual(1 + 1e-9);
  });

  it('is frame-rate independent', () => {
    const at30 = settle(0.2, 1 / 30, 0.5);
    const at144 = settle(0.2, 1 / 144, 0.5);
    expect(at30.x).toBeCloseTo(at144.x, 1);
  });

  it('damp halves the gap every half-life', () => {
    expect(damp(0, 1, 0.5, 0.5)).toBeCloseTo(0.5);
    expect(damp(0, 1, 0.5, 1)).toBeCloseTo(0.75);
  });

  it('picks the nearest equivalent angle', () => {
    expect(nearestAngleDeg(350, 10)).toBe(370);
    expect(nearestAngleDeg(-170, 170)).toBe(-190);
    expect(nearestAngleDeg(720, 0)).toBe(720);
  });
});
