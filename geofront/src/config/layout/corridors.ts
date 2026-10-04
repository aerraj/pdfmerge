/**
 * HQ corridors (z5-corridors), inside and below the pyramid's west face. Footprints are
 * world rectangles (x west→east, z north→south), m. [est] blocked out from ep01: an
 * entrance hall, a long corridor, two long escalators with a turn between them (where
 * Misato gets lost), a junction where Ritsuko meets them, and the lift down to the cage.
 */
export const CORRIDORS = {
  /** Entrance hall footprint, m. [est] */
  hall: { x0: -300, x1: -264, z0: -10, z1: 10 },
  /** Entrance hall height, m. [est] */
  hallHeightM: 8,
  /** Corridor A from the hall to the first escalator, length, m. [est] */
  corridorALengthM: 40,
  /** Landing between the escalators, square side, m. [est] */
  landingSizeM: 6.4,
  /** Corridor B (after the turn) length, m. [est] */
  corridorBLengthM: 30,
  /** Corridor C1 (lower level, landing to junction) length, m. [est] */
  corridorC1LengthM: 26,
  /** Junction room square side, m. [est] where Ritsuko meets them. */
  junctionSizeM: 8,
  /** Corridor C2 (junction to lift lobby) length, m. [est] */
  corridorC2LengthM: 38,
  /** Lift lobby square side, m. [est] */
  lobbySizeM: 8,
  /** Lift car square side, m. [est] large goods lift. */
  liftSizeM: 4,
  /** Lift car height, m. [est] */
  liftHeightM: 3.2,
  /** Signage panel size (width, height), m. [est] */
  signWidthM: 1.6,
  signHeightM: 0.5,
  /** Signage mounting height above the floor, m. [est] */
  signHeightAboveFloorM: 2.4,
} as const;

/** Guided linger at z5 points of interest, s. [tuned] */
export const Z5_LINGER = {
  hallSec: 3,
  signSec: 2,
  escalatorSec: 0,
  lostSec: 5,
  ritsukoSec: 6,
  lobbySec: 2,
  terminalSec: 0,
} as const;
