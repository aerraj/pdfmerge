import { create } from 'zustand';
import { ZONE_ROUTE } from '../config/world';
import type { ZoneId } from '../contracts/manifest';

/** Which renderer backend actually came up, and how depth is stored. */
export interface RendererStatus {
  backend: 'webgpu' | 'webgl2';
  /** GPU or adapter description, for diagnostics and bench reports. */
  gpu: string;
  depth: 'reversed-float' | 'logarithmic' | 'standard';
  /** Browser compatibility shims that had to be installed (see scene/webgpuCompat.ts). */
  shims: string[];
}

export type ZoneStatus = Partial<Record<ZoneId, 'loading' | 'ready'>>;

export interface GeoState {
  renderer: RendererStatus | null;
  /** The zone Shinji is in. Changing it drives the zone streamer. */
  zone: ZoneId;
  /** Load state of every zone the streamer currently holds. */
  zoneStatus: ZoneStatus;
  /** Last zone that failed to load, with the reason (diagnostics only). */
  zoneError: { id: ZoneId; message: string } | null;
  setRenderer: (status: RendererStatus) => void;
  setZone: (id: ZoneId) => void;
  setZoneStatus: (status: ZoneStatus) => void;
  setZoneError: (error: { id: ZoneId; message: string } | null) => void;
}

const [FIRST_ZONE] = ZONE_ROUTE;

/**
 * The single source of truth shared by the 3D scene and the in-world terminal screens.
 * Slices are added as systems arrive (control state, settings). Per-frame data never
 * goes through the store, so subscribing components never re-render every frame.
 */
export const useGeoStore = create<GeoState>()((set) => ({
  renderer: null,
  zone: FIRST_ZONE,
  zoneStatus: {},
  zoneError: null,
  setRenderer: (renderer) => {
    set({ renderer });
  },
  setZone: (zone) => {
    set({ zone });
  },
  setZoneStatus: (zoneStatus) => {
    set({ zoneStatus });
  },
  setZoneError: (zoneError) => {
    set({ zoneError });
  },
}));
