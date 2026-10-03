/**
 * Audio mix constants. Source tags as in scale.ts.
 */

/** The score: "A Cruel Angel's Thesis" (Japanese version), supplied locally. */
export const MUSIC = {
  /** Track location under public/, path. [doc] */
  trackUrl: '/audio/music/cruel_angels_thesis_jp.ogg',
  /** Cue point file under public/, path. [doc] */
  cuesUrl: '/audio/music/cues.json',
  /** Music level change while a character speaks, dB. [doc] "ducks it 8 to 10 dB under dialogue". */
  duckDb: -9,
  /** Time to reach the ducked level, s. [tuned] */
  duckAttackSec: 0.25,
  /** Time to recover after a line ends, s. [tuned] */
  duckReleaseSec: 0.9,
  /** Default fade for a music cut, s. [doc] scene.json example "fadeSec": 0.5. */
  cutFadeSec: 0.5,
  /** Crossfade between cue sections, s. [tuned] */
  crossfadeSec: 2,
} as const;

/** Default bus levels (changed on the in-world terminals). */
export const MIX_DEFAULTS = {
  /** Master gain, ratio. [tuned] */
  master: 0.85,
  /** Music bus gain, ratio. [tuned] */
  music: 0.8,
  /** Dialogue bus gain, ratio. [tuned] */
  voice: 1,
  /** Ambience bus gain, ratio. [tuned] */
  ambience: 0.7,
} as const;

/** Zone ambience. */
export const AMBIENCE = {
  /** Crossfade between zone ambience beds, s. [tuned] long enough to hide behind a door or lift ride. */
  zoneCrossfadeSec: 3,
} as const;
