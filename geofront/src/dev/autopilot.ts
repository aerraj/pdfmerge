import { MathUtils } from 'three';
import { input } from '../core/input/input';
import { playerState } from '../core/playerState';
import { useGeoStore } from '../core/store';

export interface Waypoint {
  name: string;
  x: number;
  y: number;
  z: number;
  /** A trigger counts as reached when it changes the zone (or Shinji reaches its centre). */
  kind: 'point' | 'trigger';
}

export interface WalkOptions {
  /** Horizontal distance that counts as arrived, m. */
  arriveM: number;
  /** Simulated seconds without getting closer before declaring Shinji stuck. */
  stuckSec: number;
  /** Required progress within stuckSec, m. */
  stuckProgressM: number;
}

export interface WalkResult {
  reached: string[];
  failedAt: string | null;
  reason: string | null;
  /** Largest height lost while airborne, m. Ramps and stairs stay grounded; a fall does not. */
  worstFallM: number;
  respawns: number;
  simSec: number;
}

const nextFrame = () => new Promise<number>((resolve) => requestAnimationFrame(resolve));

/** Walks Shinji through waypoints by steering the input override, like a player would. */
export async function walkRoute(points: readonly Waypoint[], options: WalkOptions): Promise<WalkResult> {
  const reached: string[] = [];
  const startRespawns = playerState.respawns;
  const startSim = playerState.simTimeSec;
  let worstFallM = 0;
  let groundY = playerState.feet.y;
  try {
    for (const target of points) {
      const startZone = useGeoStore.getState().zone;
      let best = Infinity;
      let bestAt = playerState.simTimeSec;
      for (;;) {
        await nextFrame();
        const feet = playerState.feet;
        const dx = target.x - feet.x;
        const dz = target.z - feet.z;
        const dist = Math.hypot(dx, dz);
        if (playerState.grounded) groundY = feet.y;
        else worstFallM = Math.max(worstFallM, groundY - feet.y);
        if (playerState.respawns !== startRespawns) {
          return { reached, failedAt: target.name, reason: 'fell and was respawned', worstFallM, respawns: playerState.respawns - startRespawns, simSec: playerState.simTimeSec - startSim };
        }
        const zoneChanged = useGeoStore.getState().zone !== startZone;
        if (dist < options.arriveM || (target.kind === 'trigger' && zoneChanged)) break;
        if (dist < best - options.stuckProgressM) {
          best = dist;
          bestAt = playerState.simTimeSec;
        } else if (playerState.simTimeSec - bestAt > options.stuckSec) {
          return { reached, failedAt: target.name, reason: `stuck ${dist.toFixed(1)} m away`, worstFallM, respawns: 0, simSec: playerState.simTimeSec - startSim };
        }
        input.override = { worldDirection: [dx / dist, dz / dist], faceYawDeg: MathUtils.radToDeg(Math.atan2(-dx, -dz)) };
      }
      reached.push(target.name);
    }
    return { reached, failedAt: null, reason: null, worstFallM, respawns: playerState.respawns - startRespawns, simSec: playerState.simTimeSec - startSim };
  } finally {
    input.override = null;
  }
}
