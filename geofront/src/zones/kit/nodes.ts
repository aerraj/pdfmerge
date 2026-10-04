import { MathUtils, Vector3, type Quaternion } from 'three';
import type { PlaceholderMaterialKey } from '../../config/materials';
import { quaternionFromDeg } from './geometry';
import type { GeometryPart, GeometrySpec, NodeSpec, Vec3 } from './spec';

/** Rounds to the millimetre so generated files stay readable and diffs stay stable. */
const MM_PER_M = 1000;
export const mm = (v: number): number => Math.round(v * MM_PER_M) / MM_PER_M;
export const mm3 = (v: Vec3): Vec3 => [mm(v[0]), mm(v[1]), mm(v[2])];
export const add = (a: Vec3, b: Vec3): Vec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
/** Mutable copy, rounded to the millimetre, for manifest fields. */
export const tuple = (v: Vec3): [number, number, number] => [mm(v[0]), mm(v[1]), mm(v[2])];

/** An empty marking a point of interest or character mark; it faces its local -Z. */
export function poi(name: string, at: Vec3, yawDeg = 0, pitchDeg = 0): NodeSpec {
  return { name, position: mm3(at), rotationDeg: [pitchDeg, yawDeg, 0] };
}

/** A trigger volume: an empty whose scale is the box's half extents (Blender cube empty, size 1). */
export function trigger(name: string, centre: Vec3, halfExtents: Vec3, yawDeg = 0): NodeSpec {
  return { name, position: mm3(centre), rotationDeg: [0, yawDeg, 0], scale: halfExtents };
}

export function meshNode(name: string, material: PlaceholderMaterialKey, geometry: GeometrySpec, position: Vec3 = [0, 0, 0]): NodeSpec {
  return { name, position: mm3(position), mesh: { geometry, material } };
}

export function merged(name: string, material: PlaceholderMaterialKey, parts: readonly GeometryPart[], position: Vec3 = [0, 0, 0]): NodeSpec {
  return meshNode(name, material, { kind: 'merged', parts }, position);
}

export function boxPart(centre: Vec3, size: Vec3, rotationDeg?: Vec3): GeometryPart {
  return rotationDeg ? { geometry: { kind: 'box', size }, position: centre, rotationDeg } : { geometry: { kind: 'box', size }, position: centre };
}

/** Horizontal slab whose top surface is at `topY`. */
export function slabPart(x0: number, x1: number, z0: number, z1: number, topY: number, thickness: number): GeometryPart {
  return boxPart([(x0 + x1) / 2, topY - thickness / 2, (z0 + z1) / 2], [Math.abs(x1 - x0), thickness, Math.abs(z1 - z0)]);
}

/**
 * Inclined slab whose top surface centreline runs from `a` to `b` (ramps, escalators,
 * shafts, viaducts). `offsetUp` moves the box along its own normal, e.g. to put a ceiling
 * slab above a floor slab.
 */
export function slabBetween(a: Vec3, b: Vec3, width: number, thickness: number, offsetUp = 0): GeometryPart {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const dz = b[2] - a[2];
  const horizontal = Math.hypot(dx, dz);
  const length = Math.hypot(horizontal, dy);
  const yawDeg = MathUtils.radToDeg(Math.atan2(-dx, -dz));
  const pitchDeg = MathUtils.radToDeg(Math.atan2(dy, horizontal));
  const rotationDeg: Vec3 = [pitchDeg, yawDeg, 0];
  const up = new Vector3(0, 1, 0).applyQuaternion(quaternionFromDeg(rotationDeg));
  const shift = offsetUp - thickness / 2;
  const centre: Vec3 = [(a[0] + b[0]) / 2 + up.x * shift, (a[1] + b[1]) / 2 + up.y * shift, (a[2] + b[2]) / 2 + up.z * shift];
  return boxPart(centre, [width, thickness, length], rotationDeg);
}

/** The same slab as slabBetween, cut into pieces no longer than `maxLength` (for collision). */
export function segmentedSlabBetween(a: Vec3, b: Vec3, width: number, thickness: number, offsetUp: number, maxLength: number): GeometryPart[] {
  const length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
  const count = Math.max(1, Math.ceil(length / maxLength));
  return Array.from({ length: count }, (_, i) => slabBetween(lerp3(a, b, i / count), lerp3(a, b, (i + 1) / count), width, thickness, offsetUp));
}

/** Point at fraction t along a segment. */
export function lerp3(a: Vec3, b: Vec3, t: number): Vec3 {
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

/** Yaw (deg, 0 = facing -Z) that looks from `from` towards `to`. */
export function yawTowards(from: Vec3, to: Vec3): number {
  return MathUtils.radToDeg(Math.atan2(-(to[0] - from[0]), -(to[2] - from[2])));
}

/** Pitch (deg, positive = up) that looks from `from` towards `to`. */
export function pitchTowards(from: Vec3, to: Vec3): number {
  return MathUtils.radToDeg(Math.atan2(to[1] - from[1], Math.hypot(to[0] - from[0], to[2] - from[2])));
}

export type Side = 'north' | 'south' | 'east' | 'west';

/** Axis-aligned room footprint: x0 < x1 (west to east), z0 < z1 (north to south). */
export interface Rect {
  x0: number;
  x1: number;
  z0: number;
  z1: number;
}

export interface RoomOpening {
  side: Side;
  /** Interval along the wall: x for north/south walls, z for east/west walls. */
  from: number;
  to: number;
  /** Height of the opening above the floor; a lintel fills the wall above it. Full height if omitted. */
  top?: number;
}

export interface RoomSpec {
  rect: Rect;
  floorY: number;
  height: number;
  /** Sides with no wall at all (where a corridor continues). */
  open?: readonly Side[];
  /** Doorways cut into walls. */
  openings?: readonly RoomOpening[];
}

export interface RoomParts {
  floor: GeometryPart[];
  ceiling: GeometryPart[];
  walls: GeometryPart[];
}

/** Floor, ceiling and walls of a box room; walls sit outside the footprint so the clear size is exact. */
export function roomParts(room: RoomSpec, wallThickness: number, slabThickness: number): RoomParts {
  const { rect, floorY, height } = room;
  const t = wallThickness;
  const floor = [slabPart(rect.x0 - t, rect.x1 + t, rect.z0 - t, rect.z1 + t, floorY, slabThickness)];
  const ceiling = [slabPart(rect.x0 - t, rect.x1 + t, rect.z0 - t, rect.z1 + t, floorY + height + slabThickness, slabThickness)];
  const walls: GeometryPart[] = [];
  const y = floorY + height / 2;
  const sides: { side: Side; along: 'x' | 'z'; from: number; to: number; fixed: number }[] = [
    { side: 'north', along: 'x', from: rect.x0 - t, to: rect.x1 + t, fixed: rect.z0 - t / 2 },
    { side: 'south', along: 'x', from: rect.x0 - t, to: rect.x1 + t, fixed: rect.z1 + t / 2 },
    { side: 'west', along: 'z', from: rect.z0, to: rect.z1, fixed: rect.x0 - t / 2 },
    { side: 'east', along: 'z', from: rect.z0, to: rect.z1, fixed: rect.x1 + t / 2 },
  ];
  for (const s of sides) {
    if (room.open?.includes(s.side)) continue;
    const gaps = (room.openings ?? []).filter((o) => o.side === s.side).sort((a, b) => a.from - b.from);
    let start = s.from;
    const pieces: [number, number][] = [];
    for (const g of gaps) {
      if (g.from > start) pieces.push([start, g.from]);
      start = Math.max(start, g.to);
      if (g.top !== undefined && g.top < height) {
        const lintel = height - g.top;
        const ly = floorY + g.top + lintel / 2;
        const mid = (g.from + g.to) / 2;
        const len = g.to - g.from;
        walls.push(s.along === 'x' ? boxPart([mid, ly, s.fixed], [len, lintel, t]) : boxPart([s.fixed, ly, mid], [t, lintel, len]));
      }
    }
    if (s.to > start) pieces.push([start, s.to]);
    for (const [a, b] of pieces) {
      const mid = (a + b) / 2;
      const len = b - a;
      walls.push(s.along === 'x' ? boxPart([mid, y, s.fixed], [len, height, t]) : boxPart([s.fixed, y, mid], [t, height, len]));
    }
  }
  return { floor, ceiling, walls };
}

/** Quaternion helper for code that needs to rotate offsets by a yaw. */
export function yawQuaternion(yawDeg: number): Quaternion {
  return quaternionFromDeg([0, yawDeg, 0]);
}

export interface WallHole {
  /** Interval along the wall. */
  from: number;
  to: number;
  /** Vertical interval. */
  bottom: number;
  top: number;
}

/**
 * A straight wall with rectangular holes (lift doors, windows), split into solid boxes.
 * `along` is the axis the wall runs on; `fixed` its position on the other axis.
 */
export function wallWithHoles(
  along: 'x' | 'z',
  fixed: number,
  from: number,
  to: number,
  bottom: number,
  top: number,
  thickness: number,
  holes: readonly WallHole[],
): GeometryPart[] {
  const cuts = [...new Set([from, to, ...holes.flatMap((h) => [h.from, h.to])])].filter((c) => c >= from && c <= to).sort((a, b) => a - b);
  const parts: GeometryPart[] = [];
  for (let i = 0; i + 1 < cuts.length; i++) {
    const a = cuts[i] ?? from;
    const b = cuts[i + 1] ?? to;
    if (b - a <= 0) continue;
    const mid = (a + b) / 2;
    const covering = holes.filter((h) => h.from <= a && h.to >= b).sort((h1, h2) => h1.bottom - h2.bottom);
    let y = bottom;
    const spans: [number, number][] = [];
    for (const h of covering) {
      if (h.bottom > y) spans.push([y, h.bottom]);
      y = Math.max(y, h.top);
    }
    if (top > y) spans.push([y, top]);
    for (const [y0, y1] of spans) {
      const centre: Vec3 = along === 'x' ? [mid, (y0 + y1) / 2, fixed] : [fixed, (y0 + y1) / 2, mid];
      const size: Vec3 = along === 'x' ? [b - a, y1 - y0, thickness] : [thickness, y1 - y0, b - a];
      parts.push(boxPart(centre, size));
    }
  }
  return parts;
}
