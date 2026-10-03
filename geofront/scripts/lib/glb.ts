/**
 * Minimal GLB reader: returns the glTF JSON chunk without touching binary buffers, so
 * node names can be checked even when geometry is Meshopt- or Draco-compressed.
 */

export interface GltfNode {
  name?: string;
  children?: number[];
  mesh?: number;
  translation?: [number, number, number];
  rotation?: [number, number, number, number];
  scale?: [number, number, number];
  extras?: unknown;
}

export interface GltfJson {
  asset: { version: string; generator?: string };
  scene?: number;
  scenes?: { name?: string; nodes?: number[] }[];
  nodes?: GltfNode[];
  meshes?: { name?: string }[];
  extensionsUsed?: string[];
}

const GLB_MAGIC = 0x46546c67; // "glTF"
const CHUNK_JSON = 0x4e4f534a; // "JSON"
const HEADER_BYTES = 12;
const CHUNK_HEADER_BYTES = 8;
const GLB_VERSION = 2;

export function readGlbJson(bytes: Uint8Array): GltfJson {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < HEADER_BYTES + CHUNK_HEADER_BYTES) throw new Error('file too small to be a GLB');
  if (view.getUint32(0, true) !== GLB_MAGIC) throw new Error('not a GLB (bad magic)');
  if (view.getUint32(4, true) !== GLB_VERSION) throw new Error('unsupported GLB version');
  const jsonLength = view.getUint32(HEADER_BYTES, true);
  if (view.getUint32(HEADER_BYTES + 4, true) !== CHUNK_JSON) throw new Error('first GLB chunk is not JSON');
  const start = HEADER_BYTES + CHUNK_HEADER_BYTES;
  const text = new TextDecoder().decode(bytes.subarray(start, start + jsonLength));
  return JSON.parse(text) as GltfJson;
}

/** Walks the default scene, yielding each node with its parent chain. */
export function* walkScene(gltf: GltfJson): Generator<{ index: number; node: GltfNode; ancestors: GltfNode[] }> {
  const nodes = gltf.nodes ?? [];
  const scene = gltf.scenes?.[gltf.scene ?? 0];
  const stack: { index: number; ancestors: GltfNode[] }[] = (scene?.nodes ?? []).map((index) => ({ index, ancestors: [] }));
  while (stack.length > 0) {
    const item = stack.pop();
    if (!item) break;
    const node = nodes[item.index];
    if (!node) continue;
    yield { index: item.index, node, ancestors: item.ancestors };
    for (const child of node.children ?? []) stack.push({ index: child, ancestors: [...item.ancestors, node] });
  }
}
