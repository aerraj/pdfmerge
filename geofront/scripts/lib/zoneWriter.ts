/**
 * Writes placeholder zone specs (src/zones) to contract-valid, Meshopt-compressed GLBs
 * with gltf-transform: the same optimisation path authored zones go through.
 */
import { Document, NodeIO, type Material, type Node as GltfNode } from '@gltf-transform/core';
import { ALL_EXTENSIONS, KHRMaterialsEmissiveStrength } from '@gltf-transform/extensions';
import { dedup, getBounds, meshopt, prune } from '@gltf-transform/functions';
import { MeshoptDecoder, MeshoptEncoder } from 'meshoptimizer';
import { Color } from 'three';
import { PLACEHOLDER_MATERIALS, type PlaceholderMaterial, type PlaceholderMaterialKey } from '../../src/config/materials';
import { buildGeometry, quaternionFromDeg } from '../../src/zones/kit/geometry';
import type { NodeSpec, ScaleCheck, ZoneSpec } from '../../src/zones/kit/spec';

/** Position bits for quantisation: 16 bits keeps ~1 cm on a 600 m mesh. */
const QUANTIZE_POSITION_BITS = 16;
const MAX_UINT16 = 65535;

function linear(hex: number): [number, number, number] {
  const c = new Color().setHex(hex);
  return [c.r, c.g, c.b];
}

function createMaterial(doc: Document, key: PlaceholderMaterialKey, def: PlaceholderMaterial): Material {
  const material = doc
    .createMaterial(key)
    .setBaseColorFactor([...linear(def.color), 1])
    .setRoughnessFactor(def.roughness)
    .setMetallicFactor(def.metalness)
    .setDoubleSided(def.doubleSided ?? false);
  if (def.emissive !== undefined) {
    material.setEmissiveFactor(linear(def.emissive));
    if (def.emissiveStrength !== undefined && def.emissiveStrength !== 1) {
      const ext = doc.createExtension(KHRMaterialsEmissiveStrength);
      material.setExtension('KHR_materials_emissive_strength', ext.createEmissiveStrength().setEmissiveStrength(def.emissiveStrength));
    }
  }
  return material;
}

export function zoneToDocument(spec: ZoneSpec): Document {
  const doc = new Document();
  const buffer = doc.createBuffer();
  const scene = doc.createScene(spec.id);
  doc.getRoot().setDefaultScene(scene);
  const materials = new Map<PlaceholderMaterialKey, Material>();
  const materialFor = (key: PlaceholderMaterialKey) => {
    let m = materials.get(key);
    if (!m) {
      m = createMaterial(doc, key, PLACEHOLDER_MATERIALS[key]);
      materials.set(key, m);
    }
    return m;
  };

  const build = (n: NodeSpec): GltfNode => {
    const node = doc.createNode(n.name);
    if (n.position) node.setTranslation([n.position[0], n.position[1], n.position[2]]);
    if (n.rotationDeg) {
      const q = quaternionFromDeg(n.rotationDeg);
      node.setRotation([q.x, q.y, q.z, q.w]);
    }
    if (n.scale) node.setScale([n.scale[0], n.scale[1], n.scale[2]]);
    if (n.mesh) {
      if (n.children?.length) throw new Error(`${n.name}: mesh nodes must be leaves (quantisation rewrites their transform)`);
      const g = buildGeometry(n.mesh.geometry);
      const position = g.getAttribute('position');
      const normal = g.getAttribute('normal');
      const uv = g.getAttribute('uv');
      const index = g.getIndex();
      if (!index) throw new Error(`${n.name}: geometry has no index`);
      const indexArray = position.count > MAX_UINT16 ? new Uint32Array(index.array) : new Uint16Array(index.array);
      const prim = doc
        .createPrimitive()
        .setAttribute('POSITION', doc.createAccessor().setType('VEC3').setArray(new Float32Array(position.array)).setBuffer(buffer))
        .setAttribute('NORMAL', doc.createAccessor().setType('VEC3').setArray(new Float32Array(normal.array)).setBuffer(buffer))
        .setAttribute('TEXCOORD_0', doc.createAccessor().setType('VEC2').setArray(new Float32Array(uv.array)).setBuffer(buffer))
        .setIndices(doc.createAccessor().setType('SCALAR').setArray(indexArray).setBuffer(buffer))
        .setMaterial(materialFor(n.mesh.material));
      node.setMesh(doc.createMesh(n.name).addPrimitive(prim));
      g.dispose();
    }
    for (const child of n.children ?? []) node.addChild(build(child));
    return node;
  };
  for (const n of spec.nodes) scene.addChild(build(n));
  return doc;
}

/** dedup → prune (empties kept: POI_/TRG_/LGT_ are leaves) → Meshopt with 16-bit positions. */
export async function optimise(doc: Document): Promise<void> {
  await MeshoptEncoder.ready;
  await doc.transform(
    dedup(),
    prune({ keepLeaves: true, keepExtras: true, keepAttributes: true }),
    meshopt({ encoder: MeshoptEncoder, level: 'medium', quantizePosition: QUANTIZE_POSITION_BITS }),
  );
}

export async function createIO(): Promise<NodeIO> {
  await Promise.all([MeshoptEncoder.ready, MeshoptDecoder.ready]);
  return new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({
    'meshopt.encoder': MeshoptEncoder,
    'meshopt.decoder': MeshoptDecoder,
  });
}

/** World-space extent of a named node (and its subtree) along one axis, m. */
export function measure(doc: Document, check: ScaleCheck): number | null {
  const node = doc.getRoot().listNodes().find((n) => n.getName() === check.node);
  if (!node) return null;
  const { min, max } = getBounds(node);
  const axis = { x: 0, y: 1, z: 2 }[check.axis];
  return (max[axis] ?? 0) - (min[axis] ?? 0);
}
