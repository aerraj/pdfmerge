/** Small deterministic PRNG (mulberry32) so placeholder scatter is identical on every build. */
const MULBERRY_INCREMENT = 0x6d2b79f5;
const SHIFT_A = 15;
const SHIFT_B = 7;
const SHIFT_C = 14;
const MIX = 61;
const UINT32_RANGE = 4294967296;

export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + MULBERRY_INCREMENT) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> SHIFT_A), t | 1);
    t ^= t + Math.imul(t ^ (t >>> SHIFT_B), t | MIX);
    return ((t ^ (t >>> SHIFT_C)) >>> 0) / UINT32_RANGE;
  };
}

/** Uniform value in [min, max). */
export function between(rng: () => number, min: number, max: number): number {
  return min + (max - min) * rng();
}
