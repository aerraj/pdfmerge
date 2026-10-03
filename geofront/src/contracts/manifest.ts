/**
 * Zone manifest contract: public/zones/<zone-id>/manifest.json (design doc, "Data contracts").
 * All file paths are relative to the zone's folder.
 */
import { z } from 'zod';
import { ZONE_ROUTE } from '../config/world';
import { hasPrefix, type NodePrefix } from './nodeNames';

export const ZoneIdSchema = z.enum(ZONE_ROUTE);
export type ZoneId = z.infer<typeof ZoneIdSchema>;

export const Vec3Schema = z.tuple([z.number(), z.number(), z.number()]);
export type Vec3 = z.infer<typeof Vec3Schema>;

/** A path inside the zone folder: no absolute paths, no "..", no backslashes. */
export function relativeFile(extensions: readonly string[]) {
  const ext = extensions.map((e) => e.replace('.', '\\.')).join('|');
  return z
    .string()
    .regex(new RegExp(`^(?!/)(?!.*\\.\\.)[A-Za-z0-9_\\-./]+(${ext})$`), `must be a relative path ending in ${extensions.join(' or ')}`);
}

export const AudioFileSchema = relativeFile(['.ogg', '.wav', '.mp3']);

export function nodeName(prefix: NodePrefix) {
  return z.string().refine((name) => hasPrefix(name, prefix), { message: `must be a valid ${prefix}_ node name` });
}

export const PoiEventSchema = z.discriminatedUnion('type', [
  /** Public-address announcement with a terminal-style subtitle. */
  z.strictObject({ type: z.literal('pa'), audio: AudioFileSchema, subtitle: z.string().min(1) }),
  /** A door opening or closing (the node is the door mesh or its trigger). */
  z.strictObject({ type: z.literal('door'), node: z.string(), action: z.enum(['open', 'close']) }),
  /** A terminal screen waking up. */
  z.strictObject({ type: z.literal('terminal'), screen: nodeName('SCR') }),
  /** A card reader swipe that opens a door. */
  z.strictObject({ type: z.literal('card'), reader: z.string(), opens: z.string().optional() }),
]);
export type PoiEvent = z.infer<typeof PoiEventSchema>;

export const PoiSchema = z.strictObject({
  id: z.string().regex(/^poi-[a-z0-9]+(?:-[a-z0-9]+)*$/, 'must look like poi-some-name'),
  node: nodeName('POI'),
  /** How long the guided camera lingers here, s. */
  lingerSec: z.number().nonnegative(),
  event: PoiEventSchema.optional(),
});
export type Poi = z.infer<typeof PoiSchema>;

export const TransitionSchema = z.strictObject({
  /** What hides the zone change: riding a vehicle, a blast door, a lift ride, or a corridor turn. */
  type: z.enum(['vehicle', 'door', 'lift', 'walk']),
  triggerNode: nodeName('TRG'),
});
export type Transition = z.infer<typeof TransitionSchema>;

export const ZoneManifestSchema = z.strictObject({
  id: ZoneIdSchema,
  glb: relativeFile(['.glb']),
  /** Next zone on the route; null only for the final zone. The key itself is required. */
  next: ZoneIdSchema.nullable(),
  /** Previous zone on the route; null only for the first zone. The key itself is required. */
  prev: ZoneIdSchema.nullable(),
  spawn: z.strictObject({
    /** World position of Shinji's feet; the camera adds SHINJI.eyeHeightM (DECISIONS D-011). */
    position: Vec3Schema,
    yawDeg: z.number(),
  }),
  /** Theatre.js guided path; optional until T2.1 authors one per zone. */
  guidedPath: relativeFile(['.json']).nullable().optional(),
  /** How the visitor leaves this zone; null only for the final zone. */
  transition: TransitionSchema.nullable(),
  ambience: z.array(AudioFileSchema),
  reverb: AudioFileSchema.nullable().optional(),
  pois: z.array(PoiSchema),
  /**
   * Neighbouring zones that stay visible while this zone is current (the cavern behind the
   * pyramid arrival, the pyramid ahead during the reveal). Extension to the doc's example.
   */
  alsoVisible: z.array(ZoneIdSchema).optional(),
});
export type ZoneManifest = z.infer<typeof ZoneManifestSchema>;
