/**
 * Frame-rate-independent smoothing. Every camera motion goes through one of these (design
 * doc: "all camera motion uses critically damped springs or authored curves, never raw
 * input"). Exact solutions from D. Holden, "Spring-It-On" (2021).
 */

const MIN_HALF_LIFE_SEC = 1e-5;
const DAMPING_PER_HALF_LIFE = 4 * Math.LN2;

export interface Spring {
  /** Position. */
  x: number;
  /** Velocity. */
  v: number;
}

/** Advances a critically damped spring towards `target`. `halfLifeSec` is how fast it settles. */
export function stepCriticalSpring(s: Spring, target: number, halfLifeSec: number, dt: number): void {
  const y = DAMPING_PER_HALF_LIFE / Math.max(halfLifeSec, MIN_HALF_LIFE_SEC) / 2;
  const j0 = s.x - target;
  const j1 = s.v + j0 * y;
  const decay = Math.exp(-y * dt);
  s.x = decay * (j0 + j1 * dt) + target;
  s.v = decay * (s.v - j1 * y * dt);
}

/** First-order exponential approach: halves the remaining distance every `halfLifeSec`. */
export function damp(current: number, target: number, halfLifeSec: number, dt: number): number {
  return target + (current - target) * Math.pow(2, -dt / Math.max(halfLifeSec, MIN_HALF_LIFE_SEC));
}

const FULL_TURN_DEG = 360;
const HALF_TURN_DEG = 180;

/** The angle equivalent to `targetDeg` closest to `currentDeg` (for unwrapped yaw springs). */
export function nearestAngleDeg(currentDeg: number, targetDeg: number): number {
  const diff = ((((targetDeg - currentDeg) % FULL_TURN_DEG) + FULL_TURN_DEG + HALF_TURN_DEG) % FULL_TURN_DEG) - HALF_TURN_DEG;
  return currentDeg + diff;
}
