/**
 * Music cue contract: public/audio/music/cues.json (design doc, "Data contracts").
 * Named timestamps into the supplied track, set by Rishabh against the audio.
 */
import { z } from 'zod';

/** Cues the score must provide, in the order they occur in the track. */
export const REQUIRED_CUES = ['intro', 'swell_1', 'chorus_1', 'final_chorus'] as const;

export const CueNameSchema = z.string().regex(/^[a-z]+(?:_[a-z0-9]+)*$/, 'must be snake_case, e.g. chorus_1');

export const MusicCuesSchema = z
  .strictObject({
    /** Track file name inside public/audio/music/. */
    track: z.string().regex(/^[A-Za-z0-9_-]+\.(ogg|mp3|wav)$/),
    /** True until the timestamps have been set against the real track. */
    provisional: z.boolean().optional(),
    /** Cue name to position in the track, s. */
    cues: z.record(CueNameSchema, z.number().nonnegative()),
  })
  .superRefine((value, ctx) => {
    let previous = -1;
    for (const name of REQUIRED_CUES) {
      const time = value.cues[name];
      if (time === undefined) {
        ctx.addIssue({ code: 'custom', path: ['cues', name], message: `required cue "${name}" is missing` });
        continue;
      }
      if (time <= previous) {
        ctx.addIssue({ code: 'custom', path: ['cues', name], message: `"${name}" must come after the cues before it` });
      }
      previous = time;
    }
  });
export type MusicCues = z.infer<typeof MusicCuesSchema>;
