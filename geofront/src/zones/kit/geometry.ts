import {
  BoxGeometry,
  type BufferGeometry,
  CylinderGeometry,
  Euler,
  LatheGeometry,
  MathUtils,
  Matrix4,
  Path,
  PlaneGeometry,
  Quaternion,
  Shape,
  ShapeGeometry,
  Vector2,
  Vector3,
} from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GeometryPart, GeometrySpec, Vec3 } from './spec';

const SQRT2 = Math.SQRT2;
const QUARTER_TURN = Math.PI / 2;
const EIGHTH_TURN = Math.PI / 4;
const SQUARE_SIDES = 4;

/** Euler angles (degrees) to quaternion, applied yaw (Y), then pitch (X), then roll (Z). */
export function quaternionFromDeg(rotationDeg: Vec3 | undefined): Quaternion {
  const [x, y, z] = rotationDeg ?? [0, 0, 0];
  return new Quaternion().setFromEuler(new Euler(MathUtils.degToRad(x), MathUtils.degToRad(y), MathUtils.degToRad(z), 'YXZ'));
}

function trs(position: Vec3, rotationDeg?: Vec3): Matrix4 {
  return new Matrix4().compose(new Vector3(...position), quaternionFromDeg(rotationDeg), new Vector3(1, 1, 1));
}

/** Reverses triangle winding and normals so faces point the other way. */
function flip(geometry: BufferGeometry): BufferGeometry {
  const index = geometry.getIndex();
  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const b = index.getX(i + 1);
      index.setX(i + 1, index.getX(i + 2));
      index.setX(i + 2, b);
    }
  }
  const normal = geometry.getAttribute('normal');
  for (let i = 0; i < normal.count; i++) normal.setXYZ(i, -normal.getX(i), -normal.getY(i), -normal.getZ(i));
  return geometry;
}

/** Faceted shading: split vertices per face, recompute normals, keep an index buffer. */
function faceted(geometry: BufferGeometry): BufferGeometry {
  const flat = geometry.toNonIndexed();
  flat.computeVertexNormals();
  flat.setIndex(Array.from({ length: flat.getAttribute('position').count }, (_, i) => i));
  return flat;
}

/** Ellipsoid profile from the rim (r = radius, y = 0) to the apex (r = 0, y = height). */
function domeProfile(radius: number, height: number, rings: number): Vector2[] {
  return Array.from({ length: rings + 1 }, (_, i) => {
    const t = (i / rings) * QUARTER_TURN;
    return new Vector2(Math.max(radius * Math.cos(t), 0), height * Math.sin(t));
  });
}

function primitive(spec: Exclude<GeometrySpec, { kind: 'merged' }>): BufferGeometry {
  switch (spec.kind) {
    case 'box':
      return new BoxGeometry(...spec.size);
    case 'plane':
      return new PlaneGeometry(spec.width, spec.depth).rotateX(-QUARTER_TURN);
    case 'disc': {
      const shape = new Shape().absarc(0, 0, spec.radius, 0, Math.PI * 2, false);
      // Shape space (x, y) maps to world (x, -z) after the rotation below.
      for (const hole of spec.holes ?? []) shape.holes.push(new Path().absarc(hole.x, -hole.z, hole.radius, 0, Math.PI * 2, true));
      return new ShapeGeometry(shape, spec.segments).rotateX(-QUARTER_TURN);
    }
    case 'cylinder': {
      const g = new CylinderGeometry(spec.radiusTop, spec.radiusBottom, spec.height, spec.segments, 1, spec.openEnded ?? false);
      return spec.inward ? flip(g) : g;
    }
    case 'dome': {
      const g = new LatheGeometry(domeProfile(spec.radius, spec.height, spec.rings), spec.segments);
      // Lathe faces outward; a cavern ceiling is seen from inside.
      return spec.inward ? flip(g) : g;
    }
    case 'pyramid':
      return faceted(
        new CylinderGeometry(0, spec.base / SQRT2, spec.height, SQUARE_SIDES, 1)
          .rotateY(EIGHTH_TURN)
          .translate(0, spec.height / 2, 0),
      );
    case 'frustum':
      return faceted(
        new CylinderGeometry(spec.top / SQRT2, spec.base / SQRT2, spec.height, SQUARE_SIDES, 1)
          .rotateY(EIGHTH_TURN)
          .translate(0, spec.height / 2, 0),
      );
  }
}

function placed(part: GeometryPart): BufferGeometry {
  return primitive(part.geometry).applyMatrix4(trs(part.position, part.rotationDeg));
}

/** Builds indexed geometry with position, normal and uv attributes for a spec. */
export function buildGeometry(spec: GeometrySpec): BufferGeometry {
  if (spec.kind !== 'merged') return primitive(spec);
  const parts = spec.parts.map(placed);
  // Typed as non-null, but returns null when attributes differ.
  const merged = mergeGeometries(parts, false) as BufferGeometry | null;
  if (!merged) throw new Error('placeholder geometry: parts could not be merged (attribute mismatch)');
  for (const p of parts) p.dispose();
  return merged;
}
