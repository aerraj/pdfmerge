/**
 * Eva cage (z7-cage), reached by lift from the HQ corridors. Three bays open onto a
 * coolant channel; the boat crosses the channel from the dock to Unit-01's face, and the
 * control window looks down from the wall above the dock. [est] blocked out from ep01.
 */
export const CAGE_LAYOUT = {
  /** Dock deck height above the coolant surface, m. [est] */
  dockAboveCoolantM: 3,
  /** Dock depth from the back wall to the channel edge, m. [est] */
  dockDepthM: 9.6,
  /** Dock extent west and east of the arrival lift centre, m. [est] */
  dockWestM: 16,
  /** Dock east, m. [est] */
  dockEastM: 20,
  /** Distance between bay centres, m. [est] bay width plus a 4 m restraint wall. */
  bayPitchM: 32,
  /** Eva mark distance back from the bay mouth, m. [tuned] brings Unit-01's face close to the boat. */
  evaSetbackM: 9.5,
  /** Gantry (umbilical bridge) depth in front of the bays, m. [est] */
  gantryDepthM: 2.5,
  /** Crossing walkway width and its offset west of the lift centre, m. [est] */
  walkwayWidthM: 4,
  /** Walkway offset west, m. [est] */
  walkwayOffsetWestM: 14,
  /** Extra length of the enclosure beyond the outer bays, m. [est] */
  enclosureMarginM: 4,
  /** Ceiling height above the coolant, m. [est] tall enough for the floodlight rig. */
  ceilingAboveCoolantM: 40,
  /** Control window width and height, m. [est] */
  windowWidthM: 20,
  /** Window height, m. [est] */
  windowHeightM: 5,
  /** Control room depth behind the window, m. [est] */
  controlRoomDepthM: 8,
  /** Second lift (up to the command centre) offset east of the arrival lift, m. [est] */
  commandLiftOffsetEastM: 16,
  /** Boat size (length, width, freeboard), m. [est] small service launch. */
  boatLengthM: 8,
  /** Boat width, m. [est] */
  boatWidthM: 3,
  /** Boat freeboard, m. [est] */
  boatFreeboardM: 0.6,
  /** Where the boat stops in front of Unit-01, distance south of the bay mouth, m. [tuned] face to face. */
  revealStandOffM: 4,
  /** Reveal key light offset from Unit-01's face (x, y, z), m. [tuned] front-left, above. */
  revealKeyOffsetM: [-6, 6, 10],
  /** Reveal rim light offset from the face, m. [tuned] behind and above. */
  revealRimOffsetM: [5, 8, -6],
  /** Reveal fill light offset from the face, m. [tuned] from below, like the coolant glow. */
  revealFillOffsetM: [0, -6, 6],
  /** Spacing between Misato's and Ritsuko's marks on the dock, m. [tuned] */
  markSpacingM: 4,
  /** Unit-01's eye line as a fraction of its height, ratio. [est] */
  faceHeightRatio: 0.93,
  /** Floodlights on the ceiling, count. [est] */
  floodlightCount: 6,
  /** Floodlight housing size, m. [est] */
  floodlightSizeM: 2,
} as const;

/** Guided linger at z7 points of interest, s. [tuned] */
export const Z7_LINGER = {
  dockSec: 3,
  revealSec: 8,
  gantrySec: 4,
  terminalSec: 0,
} as const;
