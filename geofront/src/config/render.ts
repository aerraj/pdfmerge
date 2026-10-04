/**
 * Renderer, camera and image constants. Source tags as in scale.ts.
 * Post-processing and per-zone lighting values join this file in T5.2 and T4.6.
 */

/** First-person camera lens. */
export const CAMERA = {
  /** Vertical field of view, deg. [tuned] natural first-person framing at 16:9 without fisheye. */
  fovDeg: 60,
  /** Near clip plane, m. [doc] "no z-fighting from 0.1 m to 10 km". */
  nearM: 0.1,
  /** Far clip plane, m. [doc] 10 km requirement plus margin for the cavern diagonal from the rim. */
  farM: 12000,
} as const;

/** Output image. */
export const IMAGE = {
  /** Tone-mapping exposure, ratio. [tuned] */
  exposure: 1,
  /** Highest device-pixel ratio rendered on high-DPI screens, ratio. [doc] "native, capped at 2× DPR". */
  maxDevicePixelRatio: 2,
  /** Lowest dynamic render scale on mobile, ratio of native. [doc] "dynamic, 0.6 to 1.0 of native". */
  minDynamicScale: 0.6,
  /** Highest dynamic render scale on mobile, ratio of native. [doc] */
  maxDynamicScale: 1,
} as const;

/** Renderer setup. */
export const RENDERER = {
  /** Preferred backend, enum: WebGPU with automatic WebGL 2 fallback. [doc] "WebGPURenderer … WebGL 2 fallback". */
  backend: 'auto' as 'auto' | 'webgpu' | 'webgl',
  /**
   * Depth strategy, enum. [doc] "Logarithmic depth buffer or reversed-Z". Reversed-Z on a float32
   * depth target keeps early-Z (log depth writes frag depth and loses it); see DECISIONS D-015.
   */
  depth: 'reversed' as 'reversed' | 'logarithmic' | 'standard',
  /** Tone-mapping operator, enum. [tuned] AgX keeps saturated sunset oranges from skewing yellow. */
  toneMapping: 'agx' as 'agx' | 'aces' | 'neutral',
  /** MSAA samples on the scene pass, count. [tuned] 0 until SMAA lands in T5.2. */
  msaaSamples: 0,
} as const;

/** Hero asset level-of-detail switch distances (HERO_*_LOD0..2), m. [tuned] LOD0 near, LOD2 beyond 1.5 km. */
export const HERO_LOD = {
  lod1FromM: 400,
  lod2FromM: 1500,
} as const;

/** Greybox lighting used until per-zone environments arrive (T3.1, T4.1). */
export const GREYBOX_LIGHTS = {
  /** Hemisphere sky colour, sRGB hex. [tuned] warm haze. */
  skyColor: 0xd9a070,
  /** Hemisphere ground colour, sRGB hex. [tuned] */
  groundColor: 0x30343a,
  /** Hemisphere intensity, ratio. [tuned] */
  hemisphereIntensity: 1.2,
  /** Key light intensity, ratio. [tuned] */
  keyIntensity: 2.2,
  /** Key light direction (towards the light), unitless. [tuned] low western sun. */
  keyDirection: [-0.6, 0.45, -0.3] as const,
  /** Background colour before environments exist, sRGB hex. [tuned] */
  background: 0x1a1612,
} as const;
