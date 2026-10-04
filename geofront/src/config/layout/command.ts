/**
 * Command centre (z6-command), inside the pyramid above the cage lifts. The main screen
 * fills the east wall; three tiers step down towards it: the commander's tower (back),
 * the operators' bridge, and the floor in front of the screen. [est] from ep01.
 */
export const COMMAND_LAYOUT = {
  /** Room footprint, m. [est] matches COMMAND width and depth in scale.ts. */
  room: { x0: -82, x1: -32, z0: 30, z1: 90 },
  /** Commander's tower depth from the back wall and height above the room floor, m. [est] */
  towerDepthM: 16,
  /** Tower rise, m. [est] */
  towerRiseM: 12,
  /** Operators' bridge depth and height above the room floor, m. [est] */
  bridgeDepthM: 16,
  /** Bridge rise, m. [est] */
  bridgeRiseM: 5,
  /** Stair width and the z position of the stair run's centre, m. [est] along the south wall. */
  stairWidthM: 2.5,
  /** Stair centre z, m. [est] */
  stairCentreZM: 85.25,
  /** Stair riser and tread, m. [real] comfortable public stair. */
  stairRiseM: 0.18,
  /** Stair tread, m. [real] */
  stairTreadM: 0.28,
  /** Console size (width across, depth, height), m. [est] */
  consoleWidthM: 3,
  /** Console depth, m. [est] */
  consoleDepthM: 1.2,
  /** Console height, m. [est] */
  consoleHeightM: 1,
  /** Operator console positions across the bridge (z), m. [est] */
  consoleZM: [52, 60, 68],
  /** Commander's desk size (width, depth, height), m. [est] */
  deskWidthM: 4,
  /** Desk depth, m. [est] */
  deskDepthM: 1.6,
  /** Desk height, m. [est] */
  deskHeightM: 0.9,
  /** Operator console screen width, m. [est] */
  consoleScreenWidthM: 1.2,
  /** Operator console screen height, m. [est] */
  consoleScreenHeightM: 0.5,
  /** Main screen bottom edge above the room floor, m. [est] */
  screenBottomM: 4,
} as const;

/** Guided linger at z6 points of interest, s. [tuned] */
export const Z6_LINGER = {
  arrivalSec: 3,
  stairsSec: 0,
  launchViewSec: 20,
  terminalSec: 0,
} as const;
