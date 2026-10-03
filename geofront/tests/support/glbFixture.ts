/** Writes a minimal GLB (JSON chunk only) containing named nodes, for validator tests. */
export interface FixtureNode {
  name?: string;
  children?: FixtureNode[];
}

const ALIGN = 4;
const SPACE = 0x20;

export function buildGlb(roots: FixtureNode[]): Uint8Array {
  const nodes: { name?: string; children?: number[] }[] = [];
  const add = (n: FixtureNode): number => {
    const index = nodes.length;
    nodes.push(n.name ? { name: n.name } : {});
    const children = (n.children ?? []).map(add);
    if (children.length) nodes[index] = { ...nodes[index], children };
    return index;
  };
  const rootIndices = roots.map(add);
  const json = JSON.stringify({ asset: { version: '2.0' }, scene: 0, scenes: [{ nodes: rootIndices }], nodes });
  const encoded = new TextEncoder().encode(json);
  const padded = Math.ceil(encoded.length / ALIGN) * ALIGN;
  const out = new Uint8Array(12 + 8 + padded);
  const view = new DataView(out.buffer);
  view.setUint32(0, 0x46546c67, true);
  view.setUint32(4, 2, true);
  view.setUint32(8, out.length, true);
  view.setUint32(12, padded, true);
  view.setUint32(16, 0x4e4f534a, true);
  out.fill(SPACE, 20);
  out.set(encoded, 20);
  return out;
}
