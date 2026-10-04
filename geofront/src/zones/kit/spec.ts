/**
 * Placeholder zone description: a tree of named nodes with simple geometry, written to
 * a contract-valid GLB by `pnpm assets`. Pure data, so it runs in Node and in tests.
 */
import type { ZoneId, ZoneManifest } from '../../contracts/manifest';
import type { PlaceholderMaterialKey } from '../../config/materials';

export type Vec3 = readonly [number, number, number];

/** Geometry primitives. Sizes in metres; every primitive is centred on its node unless noted. */
export type GeometrySpec =
  | { kind: 'box'; size: Vec3 }
  /** Horizontal rectangle facing +Y. */
  | { kind: 'plane'; width: number; depth: number }
  /** Horizontal disc facing +Y, with optional circular holes (centres relative to the disc). */
  | { kind: 'disc'; radius: number; segments: number; holes?: readonly { x: number; z: number; radius: number }[] }
  /** Upright cylinder or cone, centred on its mid-height. */
  | { kind: 'cylinder'; radiusTop: number; radiusBottom: number; height: number; segments: number; openEnded?: boolean; inward?: boolean }
  /** Ellipsoidal dome cap from y = 0 to y = height; inward faces for a cavern ceiling. */
  | { kind: 'dome'; radius: number; height: number; segments: number; rings: number; inward: boolean }
  /** Square pyramid, base on y = 0. */
  | { kind: 'pyramid'; base: number; height: number }
  /** Truncated square pyramid (frustum), base on y = 0. */
  | { kind: 'frustum'; base: number; top: number; height: number }
  /** Several parts merged into one mesh (one draw call). */
  | { kind: 'merged'; parts: readonly GeometryPart[] };

export interface GeometryPart {
  geometry: Exclude<GeometrySpec, { kind: 'merged' }>;
  position: Vec3;
  /** Rotation as [pitch X, yaw Y, roll Z], deg, applied yaw then pitch then roll. */
  rotationDeg?: Vec3;
}

export interface NodeSpec {
  name: string;
  position?: Vec3;
  /** Rotation as [pitch X, yaw Y, roll Z], deg, applied yaw then pitch then roll. */
  rotationDeg?: Vec3;
  scale?: Vec3;
  mesh?: { geometry: GeometrySpec; material: PlaceholderMaterialKey };
  children?: readonly NodeSpec[];
}

/** A dimension of a named node that pnpm assets checks against scale constants. */
export interface ScaleCheck {
  node: string;
  /** World-space bounding-box extent to measure. */
  axis: 'x' | 'y' | 'z';
  expectedM: number;
  /** Allowed relative error, ratio. */
  tolerance: number;
}

export interface ZoneSpec {
  id: ZoneId;
  nodes: readonly NodeSpec[];
  manifest: ZoneManifest;
  scaleChecks: readonly ScaleCheck[];
  /** POIs reached only aboard a vehicle (the boat, the car), so no static floor lies under them. */
  vehiclePois?: readonly string[];
}
