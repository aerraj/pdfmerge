/**
 * Scene timeline contract: public/zones/<zone-id>/scene.json (design doc, "Data contracts").
 * A scene is an ordered list of beats run by the scene director (T2.6).
 */
import { z } from 'zod';
import { CueNameSchema } from './cues';
import { ZoneIdSchema } from './manifest';
import { CHARACTER_CLIPS, CHARACTER_NODES, EVA_NODES } from './nodeNames';

export const CharacterNodeSchema = z.enum(CHARACTER_NODES);
export const ActorNodeSchema = z.enum([...CHARACTER_NODES, ...EVA_NODES]);

/** Dialogue line IDs: <zone number>_<speaker>_<two digits>, e.g. z7_gendo_01. */
export const LineIdSchema = z.string().regex(/^z[1-7]_[a-z]+(?:_[a-z]+)*_\d{2}$/, 'must look like z7_gendo_01');

/** Something the camera or a wait beat can aim at: a GLB node, a character or a unit. */
const TargetSchema = z.string().min(1);

const BeatBase = { id: z.string().regex(/^[a-z0-9_-]+$/) };

export const BeatSchema = z.discriminatedUnion('type', [
  z
    .strictObject({
      ...BeatBase,
      type: z.literal('camera'),
      /** Named guided path to fly. */
      path: z.string().optional(),
      /** Node to frame and hold on. */
      lookAt: TargetSchema.optional(),
      durationSec: z.number().positive().optional(),
      holdSec: z.number().positive().optional(),
    })
    .refine((b) => b.path !== undefined || b.lookAt !== undefined, { message: 'camera beat needs a path or a lookAt' }),
  z
    .strictObject({
      ...BeatBase,
      type: z.literal('music'),
      action: z.enum(['play', 'cut', 'crossfade', 'stop']),
      cue: CueNameSchema.optional(),
      fadeSec: z.number().nonnegative().optional(),
    })
    .refine((b) => (b.action === 'play' || b.action === 'crossfade' ? b.cue !== undefined : true), {
      message: 'play and crossfade need a cue',
    }),
  z.strictObject({ ...BeatBase, type: z.literal('lights'), preset: z.string().regex(/^[a-z0-9_]+$/) }),
  z.strictObject({ ...BeatBase, type: z.literal('line'), character: CharacterNodeSchema, lineId: LineIdSchema }),
  z.strictObject({
    ...BeatBase,
    type: z.literal('wait'),
    for: z.enum(['visitor_look', 'visitor_reach', 'line_end', 'time']),
    target: TargetSchema.optional(),
    timeoutSec: z.number().positive().optional(),
  }),
  z.strictObject({
    ...BeatBase,
    type: z.literal('move'),
    character: ActorNodeSchema,
    /** POI_ mark to walk to. */
    to: z.string().startsWith('POI_'),
    clip: z.enum(CHARACTER_CLIPS).optional(),
  }),
  z.strictObject({
    ...BeatBase,
    type: z.literal('anim'),
    character: ActorNodeSchema,
    clip: z.enum(CHARACTER_CLIPS),
    loop: z.boolean().optional(),
  }),
  z.strictObject({ ...BeatBase, type: z.literal('control'), state: z.enum(['scripted', 'freeLook', 'walk', 'terminal']) }),
  z.strictObject({ ...BeatBase, type: z.literal('event'), poi: z.string().regex(/^poi-[a-z0-9-]+$/) }),
]);
export type Beat = z.infer<typeof BeatSchema>;

export const SceneTimelineSchema = z
  .strictObject({
    scene: ZoneIdSchema,
    beats: z.array(BeatSchema),
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.beats.forEach((beat, index) => {
      if (seen.has(beat.id)) ctx.addIssue({ code: 'custom', path: ['beats', index, 'id'], message: `duplicate beat id "${beat.id}"` });
      seen.add(beat.id);
    });
  });
export type SceneTimeline = z.infer<typeof SceneTimelineSchema>;
