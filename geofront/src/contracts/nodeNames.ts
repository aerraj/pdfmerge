/**
 * GLB node naming contract (design doc, "Data contracts"). Code finds objects only by
 * these prefixes, so an approved GLB that follows them replaces a placeholder with no
 * code change.
 */

export const NODE_PREFIXES = ['GEO', 'COL', 'INST', 'PTS', 'POI', 'TRG', 'SCR', 'LGT', 'HERO', 'CHR', 'EVA'] as const;
export type NodePrefix = (typeof NODE_PREFIXES)[number];

/** Rigged characters, by node name. Shinji is the camera and has no node. */
export const CHARACTER_NODES = [
  'CHR_misato',
  'CHR_ritsuko',
  'CHR_gendo',
  'CHR_fuyutsuki',
  'CHR_rei',
  'CHR_op_maya',
  'CHR_op_makoto',
  'CHR_op_shigeru',
] as const;
export type CharacterNode = (typeof CHARACTER_NODES)[number];

/** Evangelion units, by node name. */
export const EVA_NODES = ['EVA_00', 'EVA_01', 'EVA_02'] as const;
export type EvaNode = (typeof EVA_NODES)[number];

/** Animation clip names every character GLB must contain. */
export const CHARACTER_CLIPS = ['idle', 'walk', 'talk', 'gesture_point', 'look_down', 'sit'] as const;
export type CharacterClip = (typeof CHARACTER_CLIPS)[number];

/** Lowercase snake-case body; a Blender duplicate suffix (.001) is tolerated on GEO_/COL_. */
const BODY = '[a-z0-9]+(?:_[a-z0-9]+)*';
const SIMPLE_NODE = new RegExp(`^(GEO|COL|INST|PTS|POI|TRG|SCR|LGT)_${BODY}(\\.\\d{3})?$`);
const HERO_NODE = new RegExp(`^HERO_${BODY}_LOD[0-2]$`);

/** Prefixes whose names must be unique in a zone, because code looks them up by name. */
export const UNIQUE_PREFIXES: readonly NodePrefix[] = ['POI', 'TRG', 'SCR', 'LGT', 'INST', 'PTS', 'HERO', 'CHR', 'EVA'];

/** Prefixes whose children are free-form (instance points, rigs, LOD internals). */
export const OPAQUE_PREFIXES: readonly NodePrefix[] = ['PTS', 'HERO', 'CHR', 'EVA'];

export function nodePrefix(name: string): NodePrefix | null {
  const head = name.split('_', 1)[0];
  return (NODE_PREFIXES as readonly string[]).includes(head ?? '') ? (head as NodePrefix) : null;
}

/** Why a node name breaks the contract, or null when it is valid. */
export function nodeNameProblem(name: string): string | null {
  const prefix = nodePrefix(name);
  if (!prefix) return `"${name}" has no contract prefix (${NODE_PREFIXES.map((p) => `${p}_`).join(', ')})`;
  switch (prefix) {
    case 'HERO':
      return HERO_NODE.test(name) ? null : `"${name}" must look like HERO_<name>_LOD0, _LOD1 or _LOD2`;
    case 'CHR':
      return (CHARACTER_NODES as readonly string[]).includes(name)
        ? null
        : `"${name}" is not a known character (${CHARACTER_NODES.join(', ')})`;
    case 'EVA':
      return (EVA_NODES as readonly string[]).includes(name) ? null : `"${name}" is not a known unit (${EVA_NODES.join(', ')})`;
    default:
      return SIMPLE_NODE.test(name) ? null : `"${name}" must be ${prefix}_ followed by lowercase snake_case`;
  }
}

/** Builds a Zod-friendly check that a name is valid and carries one specific prefix. */
export function hasPrefix(name: string, prefix: NodePrefix): boolean {
  return nodePrefix(name) === prefix && nodeNameProblem(name) === null;
}

/** The instancing source that pairs with a point list, and vice versa. */
export function instancePartner(name: string): string | null {
  if (name.startsWith('INST_')) return `PTS_${name.slice('INST_'.length)}`;
  if (name.startsWith('PTS_')) return `INST_${name.slice('PTS_'.length)}`;
  return null;
}
