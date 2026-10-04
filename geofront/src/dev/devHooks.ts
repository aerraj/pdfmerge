import { framesRendered, onFrame } from '../core/frameStats';
import { useGeoStore } from '../core/store';
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
    takeFrameLog: () => {
      const log = frameLog ?? [];
      frameLog = null;
      return log;
    },
  };
  Object.assign(window, { [DEV_HOOKS_GLOBAL]: hooks });
}
