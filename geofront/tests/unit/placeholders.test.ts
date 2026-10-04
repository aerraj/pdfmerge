import { execFileSync } from 'node:child_process';
import { resolve } from 'node:path';
import { Mesh, MeshBasicMaterial, Raycaster, Vector3, type Object3D } from 'three';
import { describe, expect, it } from 'vitest';
import { ZONE_ROUTE } from '../../src/config/world';
import { ZoneManifestSchema } from '../../src/contracts/manifest';
import { nodeNameProblem, nodePrefix, OPAQUE_PREFIXES } from '../../src/contracts/nodeNames';
import { buildGeometry, quaternionFromDeg } from '../../src/zones/kit/geometry';
import type { NodeSpec, Vec3, ZoneSpec } from '../../src/zones/kit/spec';
import { PLACEHOLDER_BUILDERS } from '../../src/zones/placeholders';

const ROOT = resolve(import.meta.dirname, '../..');
/** How far below a standing point the floor may be, m (kerbs, stairs, slab rounding). */
const FLOOR_TOLERANCE_M = 0.35;

function flatten(nodes: readonly NodeSpec[]): NodeSpec[] {
  return nodes.flatMap((n) => {
    const prefix = nodePrefix(n.name);
    const opaque = prefix !== null && OPAQUE_PREFIXES.includes(prefix);
    return [n, ...(opaque ? [] : flatten(n.children ?? []))];
  });
}

function colliderMeshes(spec: ZoneSpec): Object3D[] {
  return spec.nodes
    .filter((n) => n.name.startsWith('COL_') && n.mesh)
    .map((n) => {
      if (!n.mesh) throw new Error('unreachable');
      const mesh = new Mesh(buildGeometry(n.mesh.geometry), new MeshBasicMaterial());
      if (n.position) mesh.position.set(...n.position);
      if (n.rotationDeg) mesh.quaternion.copy(quaternionFromDeg(n.rotationDeg));
      if (n.scale) mesh.scale.set(...n.scale);
      mesh.updateMatrixWorld(true);
      return mesh;
    });
}

/** Distance from a standing point down to the nearest collision surface, or null if none. */
function floorBelow(colliders: Object3D[], at: Vec3): number | null {
  const ray = new Raycaster(new Vector3(at[0], at[1] + 1, at[2]), new Vector3(0, -1, 0), 0, 1 + FLOOR_TOLERANCE_M + 1);
  const hit = ray.intersectObjects(colliders, false)[0];
  return hit ? hit.distance - 1 : null;
}

describe.each(ZONE_ROUTE.map((id) => [id] as const))('placeholder %s', (id) => {
  const spec = PLACEHOLDER_BUILDERS[id]();
  const nodes = flatten(spec.nodes);
  const names = new Set(nodes.map((n) => n.name));
  const manifest = ZoneManifestSchema.parse(spec.manifest);
  const colliders = colliderMeshes(spec);

  it('uses only contract node names', () => {
    const problems = nodes.map((n) => nodeNameProblem(n.name)).filter((p) => p !== null);
    expect(problems).toEqual([]);
  });

  it('has a collision floor, its POIs and its transition trigger', () => {
    expect(colliders.length).toBeGreaterThan(0);
    for (const poi of manifest.pois) expect(names, poi.node).toContain(poi.node);
    if (manifest.transition) expect(names).toContain(manifest.transition.triggerNode);
    expect(manifest.id).toBe(id);
  });

  it('stands Shinji on a floor at spawn and at every walkable POI', () => {
    const points: [string, Vec3][] = [['spawn', manifest.spawn.position]];
    for (const n of nodes) {
      // Character marks sit where characters stand (Eva bays, control room), not on Shinji's route.
      const walkable = n.name.startsWith('POI_') && !n.name.startsWith('POI_mark_') && !spec.vehiclePois?.includes(n.name);
      if (walkable && n.position) points.push([n.name, n.position]);
    }
    const missing = points.filter(([, p]) => {
      const d = floorBelow(colliders, p);
      return d === null || d > FLOOR_TOLERANCE_M;
    });
    expect(missing.map(([name]) => name)).toEqual([]);
  });

  it('is deterministic', () => {
    expect(JSON.stringify(PLACEHOLDER_BUILDERS[id]())).toBe(JSON.stringify(spec));
  });
});

describe('committed zone assets', () => {
  it('match a fresh pnpm assets build', () => {
    // Throws (non-zero exit) when any GLB or manifest in public/zones is stale.
    execFileSync('pnpm', ['exec', 'tsx', 'scripts/build-assets.ts', '--check'], { cwd: ROOT, stdio: 'pipe' });
  }, 120_000);
});
