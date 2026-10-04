import { Vector3 } from 'three';

/** Shinji's live state, written by the player rig every frame and read by other systems. */
export const playerState = {
  /** Feet position, interpolated for this frame. */
  feet: new Vector3(),
  yawDeg: 0,
  pitchDeg: 0,
  grounded: false,
  /** The body exists and stands in a loaded zone. */
  ready: false,
  /** Times the fall safety net put Shinji back at a spawn point. */
  respawns: 0,
  /** Simulated time since start, s (affected by simulation.timeScale). */
  simTimeSec: 0,
};
