import { framesRendered, onFrame } from '../core/frameStats';
import { Vector3 } from 'three';
import { playerState } from '../core/playerState';
import { simulation } from '../core/simulation';
import { useGeoStore } from '../core/store';
import { activeStreamer } from '../core/zones/runtime';
import type { ZoneId } from '../contracts/manifest';
import { walkRoute, type WalkOptions, type WalkResult, type Waypoint } from './autopilot';
import { getRenderer } from '../scene/createRenderer';

/** What the zone viewer loaded, for end-to-end checks. */
export interface ZoneReport {
  id: string;
  error?: string;
  colliders?: { name: string; triangles: number }[];
  pois?: string[];
  triggers?: string[];
  screens?: string[];
  lights?: string[];
}

/** GPU resources the renderer holds and the JS heap (Chromium only). */
export interface MemoryReport {
  geometries: number;
  textures: number;
  /** Renderer-tracked GPU memory, bytes. */
  gpuBytes: number;
  /** Used JS heap, bytes (0 where the browser does not report it). */
  jsHeapBytes: number;
}

/** Read-only handles for end-to-end tests. Dev builds only. */
export interface DevHooks {
  getState: typeof useGeoStore.getState;
  framesRendered: typeof framesRendered;
  zone: ZoneReport | null;
  memory: () => MemoryReport;
  /** Starts collecting frame intervals (ms); takeFrameLog returns and clears them. */
  startFrameLog: () => void;
  takeFrameLog: () => number[];
  /** Main-thread render time per logged frame, ms (read before takeFrameLog). */
  takeCpuLog: () => number[];
  player: () => { feet: [number, number, number]; yawDeg: number; grounded: boolean; ready: boolean; respawns: number };
  /** World positions of a loaded zone's POI_ nodes and TRG_ volume centres. */
  zonePoints: (id: ZoneId) => Record<string, [number, number, number]> | null;
  /** Speeds up simulated time (physics still steps at its fixed rate). */
  setTimeScale: (scale: number) => void;
  walk: (points: Waypoint[], options: WalkOptions) => Promise<WalkResult>;
}

function zonePoints(id: ZoneId): Record<string, [number, number, number]> | null {
  const zone = activeStreamer()?.get(id);
  if (!zone) return null;
  const out: Record<string, [number, number, number]> = {};
  const v = new Vector3();
  for (const [name, node] of zone.pois) {
    node.getWorldPosition(v);
    out[name] = [v.x, v.y, v.z];
  }
  for (const [name, trigger] of zone.triggers) out[name] = [trigger.centre.x, trigger.centre.y, trigger.centre.z];
  return out;
}

let frameLog: number[] | null = null;
let cpuLog: number[] | null = null;
onFrame((sample) => {
  frameLog?.push(sample.deltaMs);
  cpuLog?.push(sample.cpuMs);
});

function memory(): MemoryReport {
  const m = getRenderer().info.memory;
  const heap = (performance as Performance & { memory?: { usedJSHeapSize: number } }).memory;
  return { geometries: m.geometries, textures: m.textures, gpuBytes: m.total, jsHeapBytes: heap?.usedJSHeapSize ?? 0 };
}

let hooks: DevHooks | null = null;

export function reportZone(report: ZoneReport): void {
  if (hooks) hooks.zone = report;
}

export const DEV_HOOKS_GLOBAL = '__GEOFRONT__';

export function installDevHooks(): void {
  hooks = {
    getState: useGeoStore.getState,
    framesRendered,
    zone: null,
    memory,
    startFrameLog: () => {
      frameLog = [];
      cpuLog = [];
    },
    takeCpuLog: () => {
      const log = cpuLog ?? [];
      cpuLog = null;
      return log;
    },
    player: () => ({
      feet: [playerState.feet.x, playerState.feet.y, playerState.feet.z],
      yawDeg: playerState.yawDeg,
      grounded: playerState.grounded,
      ready: playerState.ready,
      respawns: playerState.respawns,
    }),
    zonePoints,
    setTimeScale: (scale) => {
      simulation.timeScale = scale;
      simulation.maxStepsPerFrame = Math.max(simulation.maxStepsPerFrame, Math.ceil(scale * 4));
    },
    walk: walkRoute,
    takeFrameLog: () => {
      const log = frameLog ?? [];
      frameLog = null;
      return log;
    },
  };
  Object.assign(window, { [DEV_HOOKS_GLOBAL]: hooks });
}
