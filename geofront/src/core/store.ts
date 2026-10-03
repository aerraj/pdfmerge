import { create } from 'zustand';

/** Which renderer backend actually came up, and how depth is stored. */
export interface RendererStatus {
  backend: 'webgpu' | 'webgl2';
  /** GPU or adapter description, for diagnostics and bench reports. */
  gpu: string;
  depth: 'reversed-float' | 'logarithmic' | 'standard';
  /** Browser compatibility shims that had to be installed (see scene/webgpuCompat.ts). */
  shims: string[];
}

export interface GeoState {
  renderer: RendererStatus | null;
  setRenderer: (status: RendererStatus) => void;
}

/**
 * The single source of truth shared by the 3D scene and the in-world terminal screens.
 * Slices are added as systems arrive (zones, control state, settings). Per-frame data
 * never goes through the store, so subscribing components never re-render every frame.
 */
export const useGeoStore = create<GeoState>()((set) => ({
  renderer: null,
  setRenderer: (renderer) => {
    set({ renderer });
  },
}));
