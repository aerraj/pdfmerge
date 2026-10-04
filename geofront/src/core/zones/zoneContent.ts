/**
 * Turns a loaded zone GLB into runtime content by node prefix (the data contract):
 * COL_ → collision triangles (removed from the render graph), TRG_ → trigger volumes,
 * INST_/PTS_ → instanced meshes, HERO_*_LODn → LOD objects, POI_/SCR_/LGT_ → lookups.
 */
import {
  Box3,
  Group,
  InstancedMesh,
  LOD,
  Matrix4,
  type Mesh,
  Quaternion,
  Vector3,
  type BufferGeometry,
  type Material,
  type Object3D,
} from 'three';
import { HERO_LOD } from '../../config/render';
import type { ZoneId, ZoneManifest } from '../../contracts/manifest';
import { nodePrefix } from '../../contracts/nodeNames';

/** World-space triangle soup for a static collider. */
export interface ColliderData {
  name: string;
  positions: Float32Array;
  indices: Uint32Array;
}

/** Oriented box: a point is inside when its local coordinates are all within [-1, 1]. */
export class TriggerVolume {
  readonly name: string;
  readonly centre: Vector3;
  private readonly inverse: Matrix4;
  private readonly scratch = new Vector3();

  constructor(name: string, unitCubeToWorld: Matrix4) {
    this.name = name;
    this.inverse = unitCubeToWorld.clone().invert();
    this.centre = new Vector3().setFromMatrixPosition(unitCubeToWorld);
  }

  contains(point: Vector3): boolean {
    const p = this.scratch.copy(point).applyMatrix4(this.inverse);
    return Math.abs(p.x) <= 1 && Math.abs(p.y) <= 1 && Math.abs(p.z) <= 1;
  }
}

export interface ZoneContent {
  id: ZoneId;
  manifest: ZoneManifest;
  /** Everything that renders, named after the zone. */
  root: Group;
  colliders: ColliderData[];
  triggers: Map<string, TriggerVolume>;
  pois: Map<string, Object3D>;
  screens: Map<string, Mesh>;
  lights: Map<string, Object3D>;
  /** Releases every GPU resource the zone owns. */
  dispose: () => void;
}

const LOD_SUFFIX = /_LOD([0-2])$/;

function isMesh(o: Object3D): o is Mesh {
  return (o as Partial<Mesh>).isMesh === true;
}

/** Meshes in a subtree (a node may be the mesh itself or a group of primitives). */
function meshesIn(o: Object3D): Mesh[] {
  const found: Mesh[] = [];
  o.traverse((c) => {
    if (isMesh(c)) found.push(c);
  });
  return found;
}

function colliderFrom(name: string, node: Object3D): ColliderData {
  const positions: number[] = [];
  const indices: number[] = [];
  const v = new Vector3();
  for (const mesh of meshesIn(node)) {
    const geometry = mesh.geometry;
    const pos = geometry.getAttribute('position');
    const base = positions.length / 3;
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld);
      positions.push(v.x, v.y, v.z);
    }
    const index = geometry.getIndex();
    if (index) for (let i = 0; i < index.count; i++) indices.push(base + index.getX(i));
    else for (let i = 0; i < pos.count; i++) indices.push(base + i);
  }
  return { name, positions: new Float32Array(positions), indices: new Uint32Array(indices) };
}

function triggerFrom(name: string, node: Object3D): TriggerVolume {
  const meshes = meshesIn(node);
  if (meshes.length === 0) return new TriggerVolume(name, node.matrixWorld);
  // A mesh trigger: the volume is its world bounding box.
  const box = new Box3().setFromObject(node);
  const centre = box.getCenter(new Vector3());
  const half = box.getSize(new Vector3()).multiplyScalar(1 / 2);
  return new TriggerVolume(name, new Matrix4().compose(centre, new Quaternion(), half));
}

function disposeSubtree(o: Object3D, geometries: Set<BufferGeometry>, materials: Set<Material>) {
  o.traverse((c) => {
    if (isMesh(c)) {
      geometries.add(c.geometry);
      const m = c.material;
      for (const mat of Array.isArray(m) ? m : [m]) materials.add(mat);
    }
  });
}

export function buildZoneContent(id: ZoneId, manifest: ZoneManifest, scene: Object3D): ZoneContent {
  scene.updateMatrixWorld(true);
  const root = new Group();
  root.name = id;
  const colliders: ColliderData[] = [];
  const triggers = new Map<string, TriggerVolume>();
  const pois = new Map<string, Object3D>();
  const screens = new Map<string, Mesh>();
  const lights = new Map<string, Object3D>();
  const heroSets = new Map<string, Object3D[]>();
  const instSources = new Map<string, Object3D>();
  const pointLists = new Map<string, Object3D>();
  const toRemove: Object3D[] = [];
  const geometries = new Set<BufferGeometry>();
  const materials = new Set<Material>();

  for (const node of [...scene.children]) {
    const prefix = nodePrefix(node.name);
    switch (prefix) {
      case 'COL':
        colliders.push(colliderFrom(node.name, node));
        toRemove.push(node);
        break;
      case 'TRG':
        triggers.set(node.name, triggerFrom(node.name, node));
        toRemove.push(node);
        break;
      case 'POI':
        pois.set(node.name, node);
        break;
      case 'LGT':
        lights.set(node.name, node);
        break;
      case 'SCR': {
        const mesh = meshesIn(node)[0];
        if (mesh) screens.set(node.name, mesh);
        break;
      }
      case 'INST':
        instSources.set(node.name.slice('INST_'.length), node);
        toRemove.push(node);
        break;
      case 'PTS':
        pointLists.set(node.name.slice('PTS_'.length), node);
        toRemove.push(node);
        break;
      case 'HERO': {
        // Re-parented into an LOD object below, so not part of the removal pass.
        const base = node.name.replace(LOD_SUFFIX, '');
        heroSets.set(base, [...(heroSets.get(base) ?? []), node]);
        break;
      }
      default:
        break;
    }
  }

  // Instancing: each point's world matrix times the source's own local matrix.
  for (const [key, source] of instSources) {
    const points = pointLists.get(key);
    const mesh = meshesIn(source)[0];
    if (!points || !mesh) continue;
    const local = new Matrix4().copy(mesh.matrixWorld).premultiply(new Matrix4().copy(source.parent?.matrixWorld ?? new Matrix4()).invert());
    const instanced = new InstancedMesh(mesh.geometry, mesh.material, points.children.length);
    instanced.name = source.name;
    const m = new Matrix4();
    points.children.forEach((p, i) => {
      instanced.setMatrixAt(i, m.multiplyMatrices(p.matrixWorld, local));
    });
    instanced.instanceMatrix.needsUpdate = true;
    instanced.computeBoundingSphere();
    instanced.computeBoundingBox();
    root.add(instanced);
  }

  // Hero LOD sets.
  for (const [base, levels] of heroSets) {
    const lod = new LOD();
    lod.name = base;
    const distances = [0, HERO_LOD.lod1FromM, HERO_LOD.lod2FromM];
    for (const level of levels.sort((a, b) => a.name.localeCompare(b.name))) {
      const n = Number(LOD_SUFFIX.exec(level.name)?.[1] ?? 0);
      // Top-level nodes: their local matrix is already their world matrix.
      level.removeFromParent();
      lod.addLevel(level, distances[n] ?? 0);
    }
    root.add(lod);
  }

  for (const node of toRemove) {
    node.removeFromParent();
    // Collision and trigger meshes never render.
    const prefix = nodePrefix(node.name);
    if (prefix === 'COL' || prefix === 'TRG') disposeSubtree(node, geometries, materials);
  }
  for (const child of [...scene.children]) root.add(child);

  // Free collider/trigger geometry unless a rendered mesh shares it (dedup can merge them).
  const rendered = new Set<BufferGeometry>();
  disposeSubtree(root, rendered, new Set());
  for (const g of geometries) if (!rendered.has(g)) g.dispose();

  // Zones are static: compute matrices once and stop per-frame matrix updates.
  root.updateMatrixWorld(true);
  root.traverse((o) => {
    o.matrixAutoUpdate = false;
    o.matrixWorldAutoUpdate = false;
  });

  return {
    id,
    manifest,
    root,
    colliders,
    triggers,
    pois,
    screens,
    lights,
    dispose: () => {
      const g = new Set<BufferGeometry>();
      const m = new Set<Material>();
      disposeSubtree(root, g, m);
      for (const geometry of g) geometry.dispose();
      for (const material of m) material.dispose();
      root.removeFromParent();
    },
  };
}
