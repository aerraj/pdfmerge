/**
 * Movement, look and camera-feel constants for Shinji's first-person control.
 * Source tags as in scale.ts.
 */

/** Walking (control state "walk"). */
export const WALK = {
  /** Top walking speed, m/s. [anthro] relaxed walking pace of a 14-year-old; the doc caps walking at Shinji's pace. */
  speedMps: 1.3,
  /** Time to reach top speed from rest, s. [tuned] */
  accelTimeSec: 0.35,
  /** Time to stop from top speed, s. [tuned] */
  decelTimeSec: 0.25,
  /** Gravitational acceleration, m/s². [real] */
  gravityMps2: 9.81,
  /** Fastest fall speed, m/s. [tuned] keeps a fall readable and the controller stable. */
  terminalFallSpeedMps: 20,
  /** Highest step climbed automatically, m. [real] stair risers are at most 0.19 m; 0.3 m also clears kerbs. */
  maxStepM: 0.3,
  /** Narrowest tread the auto-step will climb onto, m. [tuned] */
  minStepWidthM: 0.2,
  /** Steepest slope walkable, deg. [real] escalators are 30°; 40 leaves margin for ramps and rubble. */
  maxSlopeDeg: 40,
  /** Distance the controller snaps down to stay on stairs and ramps, m. [tuned] */
  snapToGroundM: 0.35,
  /** Collision skin kept between capsule and geometry, m. [tuned] about 1 % of body size, as Rapier suggests. */
  skinM: 0.02,
  /** Below this elevation relative to the zone's lowest floor, Shinji is respawned, m. [tuned] safety net only. */
  fallLimitM: 30,
} as const;

/** Looking around. */
export const LOOK = {
  /** Mouse look rate, deg per pixel of pointer motion. [tuned] */
  mouseDegPerPx: 0.12,
  /** Touch look rate, deg per pixel of drag. [tuned] */
  touchDegPerPx: 0.22,
  /** Keyboard turn rate (arrow keys), deg/s. [tuned] */
  keyTurnDegPerSec: 90,
  /** Highest and lowest pitch, deg. [anthro] comfortable neck range without flipping. */
  maxPitchDeg: 80,
  /** Half-life of the critically damped spring that follows look input, s. [tuned] removes judder without lag. */
  smoothingHalfLifeSec: 0.045,
  /** Look-rate multiplier with reduced motion enabled, ratio. [tuned] doc: "slower turns". */
  reducedMotionRateScale: 0.6,
  /** Half-angle of the free-look cone during scripted beats, deg. [doc] "about 60° each way". */
  scriptedConeDeg: 60,
  /** Half-life of the ease back towards a beat's subject, s. [tuned] */
  scriptedReturnHalfLifeSec: 0.6,
} as const;

/** Head bob while walking (off with reduced motion). */
export const HEAD_BOB = {
  /** Vertical bob amplitude at top speed, m. [tuned] */
  verticalAmplitudeM: 0.016,
  /** Side-to-side sway amplitude at top speed, m. [tuned] */
  lateralAmplitudeM: 0.01,
  /** Step frequency at top speed, Hz. [anthro] about 108 steps per minute when walking. */
  stepFrequencyHz: 1.8,
  /** Half-life of the bob fading in and out with speed, s. [tuned] */
  fadeHalfLifeSec: 0.15,
} as const;

/** Invisible touch stick (left half of the screen moves, right half looks). */
export const TOUCH = {
  /** Drag distance for full walking speed, px. [tuned] */
  stickRadiusPx: 60,
  /** Fraction of the stick radius ignored as noise, ratio. [tuned] */
  deadZoneRatio: 0.12,
} as const;

/** Physics stepping (fixed timestep, render interpolated between steps). */
export const PHYSICS = {
  /** Fixed physics step, s. [doc] "physics runs on a fixed timestep". 60 Hz matches the desktop target. */
  fixedStepSec: 1 / 60,
  /** Most physics steps run in one rendered frame before time is dropped, count. [tuned] avoids a spiral of death. */
  maxStepsPerFrame: 4,
} as const;

/** Guided mode and control handover. */
export const GUIDED = {
  /** Idle time before free roam hands back to the guided path, s. [doc] "20 s idle return". */
  idleReturnSec: 20,
  /** Default wait-beat timeout when a scene does not set one, s. [doc] scene.json example. */
  defaultBeatTimeoutSec: 8,
} as const;

/** Pacing targets for the whole experience. */
export const PACING = {
  /** Shortest end-to-end run, s. [doc] "10 to 15 minutes". */
  experienceMinSec: 600,
  /** Longest end-to-end run, s. [doc] */
  experienceMaxSec: 900,
  /** Shortest hands-off guided run, s. [doc] "Guided mode runs 6 to 10 minutes" (DECISIONS D-012). */
  guidedMinSec: 360,
  /** Longest hands-off guided run, s. [doc] */
  guidedMaxSec: 600,
  /** Shortest hold on the full cavern view at the reveal, s. [doc] "at least 5 seconds". */
  revealHoldMinSec: 5,
} as const;
