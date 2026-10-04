/**
 * World layout: where each zone sits in the shared world frame (Y-up, right-handed,
 * origin at the centre of the cavern floor). All zones are authored in this one frame
 * so a vehicle can carry Shinji across a zone boundary without a seam (DECISIONS D-010).
 * Source tags as in scale.ts.
 */
import { CAVERN, CRUST } from './scale';

/** Scene order of the experience. The cage (z7) comes before the command centre (z6). */
export const ZONE_ROUTE = [
  'z1-surface',
  'z2-descent',
  'z3-cavern',
  'z4-pyramid',
  'z5-corridors',
  'z7-cage',
  'z6-command',
] as const;

/** Elevation of the Tokyo-3 street above the cavern floor, m. Derived: cavern height + crust. */
export const STREET_ELEVATION_M = CAVERN.heightM + CRUST.thicknessM;

/**
 * The cartrain line from the street station down to the pyramid plaza. It arrives from the
 * west: +X points from the street towards the pyramid, and -Z is north (yaw 0 faces -Z).
 */
export const CARTRAIN_LINE = {
  /** Elevation where the shaft breaks through the cavern wall, m. [est] the reveal is from high on the wall. */
  tunnelMouthElevationM: 520,
  /** Incline of the dark shaft through the crust, deg. [est] steep enough to feel like a drop. */
  shaftInclineDeg: 30,
  /** Cruise speed on the cartrain, m/s. [tuned] keeps scene 2 and 3 inside the pacing budget. */
  cruiseSpeedMps: 25,
} as const;

/** Interior floor elevations (pyramid and below), m. */
export const INTERIOR_LEVELS = {
  /** Plaza and pyramid entrance hall floor, m. [est] 10 cm above the cavern floor so paving never z-fights the ground. */
  entranceElevationM: 0.1,
  /** Lowest corridor level reached by the escalators, m. [est] two escalator runs below the entrance. */
  lowerCorridorElevationM: -48,
  /** Coolant surface in the cage, m. [est] deep below the pyramid. */
  cageCoolantElevationM: -150,
  /** Command centre lowest tier floor, m. [est] inside the pyramid above plaza level. */
  commandFloorElevationM: 12,
} as const;
