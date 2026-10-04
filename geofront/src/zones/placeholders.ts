/** Placeholder builders by zone. Every route zone has one until approved art replaces it. */
import type { ZoneId } from '../contracts/manifest';
import type { ZoneSpec } from './kit/spec';
import { buildZ1Surface } from './z1-surface/placeholder';
import { buildZ2Descent } from './z2-descent/placeholder';
import { buildZ3Cavern } from './z3-cavern/placeholder';
import { buildZ4Pyramid } from './z4-pyramid/placeholder';
import { buildZ5Corridors } from './z5-corridors/placeholder';
import { buildZ6Command } from './z6-command/placeholder';
import { buildZ7Cage } from './z7-cage/placeholder';

export const PLACEHOLDER_BUILDERS: Record<ZoneId, () => ZoneSpec> = {
  'z1-surface': buildZ1Surface,
  'z2-descent': buildZ2Descent,
  'z3-cavern': buildZ3Cavern,
  'z4-pyramid': buildZ4Pyramid,
  'z5-corridors': buildZ5Corridors,
  'z7-cage': buildZ7Cage,
  'z6-command': buildZ6Command,
};
