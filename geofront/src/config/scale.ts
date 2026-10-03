/**
 * Real-world scale constants: the single source for every dimension that geometry,
 * placeholders, camera splines and lightmaps depend on (design doc, "Scale discipline").
 * Changing a value here late breaks lightmaps, LODs and camera paths, so confirm against
 * references/<zone-id>/ first.
 *
 * Every constant carries a unit and a source tag:
 *   [doc]    the design document
 *   [fan]    commonly cited fan figures (approximate; see design doc, Open questions)
 *   [real]   real-world measurement or standard
 *   [anthro] anthropometric data
 *   [est]    estimate from series frames, pending the zone's reference board
 *   [tuned]  chosen by feel; safe to adjust
 */

/** Shinji: the visitor, who is the camera. */
export const SHINJI = {
  /** Standing eye height above the floor, m. [doc] "first-person camera at Shinji's 1.50 m eye height" (see DECISIONS D-011). */
  eyeHeightM: 1.5,
  /** Standing height to the top of the head, m. [anthro] eye height is about 0.933 × stature, so 1.50 / 0.933. */
  statureM: 1.61,
  /** Collision capsule radius, m. [anthro] half of a 0.36 m adolescent shoulder breadth plus 0.04 m clearance. */
  bodyRadiusM: 0.22,
  /** Eye height above the seat cushion when seated, m. [anthro] seated eye height is about 0.45 × stature. */
  seatedEyeAboveSeatM: 0.72,
} as const;

/** The GeoFront cavern. World origin is the centre of its floor. */
export const CAVERN = {
  /** Interior diameter at floor level, m. [doc][fan] "roughly 6 km across" (Open question 1). */
  diameterM: 6000,
  /** Floor to the apex of the dome, m. [doc][fan] "under 1 km tall" (Open question 1). */
  heightM: 900,
  /** Lake radius, m. [est] the lake spans roughly a quarter of the cavern floor in ep01 wide shots. */
  lakeRadiusM: 750,
  /** Lake centre distance from the cavern centre, m. [est] lake sits off-centre, beyond the pyramid. */
  lakeOffsetM: 1500,
  /** Lake surface height above the cavern floor datum, m. [est] slightly below the surrounding ground. */
  lakeSurfaceElevationM: -2,
} as const;

/** Rock and armour between the Tokyo-3 street and the cavern apex. */
export const CRUST = {
  /** Street level to cavern apex, m. [est] canon has 22 armour plates over the GeoFront; about 10 m per plate. */
  thicknessM: 220,
} as const;

/** NERV headquarters pyramid, centred on the world origin. */
export const PYRAMID = {
  /** Side length of the square footprint, m. [est] about a tenth of the cavern diameter in ep01 wide shots. */
  baseM: 600,
  /** Ground to apex, m. [est] steeper than Giza (0.64 × base) as drawn in the series. */
  heightM: 400,
  /** Vehicle gate opening width, m. [est] two lanes plus a guard walkway. */
  gateWidthM: 12,
  /** Vehicle gate opening height, m. [est] */
  gateHeightM: 7,
} as const;

/** NERV HQ interiors. */
export const CORRIDOR = {
  /** Clear width wall to wall, m. [est] ep01 corridors fit about four people abreast. */
  widthM: 3.2,
  /** Floor to ceiling, m. [est] */
  heightM: 3,
  /** Personnel door opening width, m. [real] common commercial door leaf plus frame. */
  doorWidthM: 1.2,
  /** Personnel door opening height, m. [real] */
  doorHeightM: 2.2,
} as const;

/** Escalators in the HQ (Misato gets lost on them). */
export const ESCALATOR = {
  /** Incline, deg. [real] standard escalator incline. */
  inclineDeg: 30,
  /** Step band speed, m/s. [real] standard escalator speed. */
  speedMps: 0.5,
  /** Vertical rise of one escalator run, m. [est] ep01 shows unusually long runs. */
  riseM: 24,
  /** Step width, m. [real] standard 1000 mm step. */
  stepWidthM: 1,
} as const;

/** Evangelion units. */
export const EVA = {
  /** Standing height, m. [fan] the commonly cited TV-series figure; later depictions vary up to 80 m. */
  heightM: 40,
} as const;

/** Eva cage (scene 6, zone z7-cage). */
export const CAGE = {
  /** Bay floor to coolant surface, m. [est] Unit-01 stands submerged to the chest in ep01. */
  depthM: 32,
  /** Width of one bay between restraint walls, m. [est] */
  bayWidthM: 28,
  /** Length of one bay from boat channel to back wall, m. [est] */
  bayLengthM: 30,
  /** Coolant surface to the control-window sill above the bay, m. [est] Gendo looks down from well above. */
  controlWindowSillM: 14,
  /** Width of the coolant channel the boat crosses, m. [est] */
  channelWidthM: 16,
} as const;

/** Misato's car, a Renault Alpine A310. */
export const CAR = {
  /** Overall length, m. [real] Alpine A310 V6. */
  lengthM: 4.18,
  /** Overall width, m. [real] */
  widthM: 1.62,
  /** Overall height, m. [real] */
  heightM: 1.15,
  /** Passenger seat cushion above the road, m. [est] low sports-car seating. */
  seatHeightM: 0.3,
} as const;

/** Command centre (scene 7, zone z6-command). */
export const COMMAND = {
  /** Room width across the main screen wall, m. [est] */
  widthM: 60,
  /** Room depth from screen wall to the commander's tower, m. [est] */
  depthM: 50,
  /** Floor of the lowest tier to ceiling, m. [est] */
  heightM: 30,
  /** Main tactical display width, m. [est] spans most of the front wall. */
  mainScreenWidthM: 40,
  /** Main tactical display height, m. [est] */
  mainScreenHeightM: 18,
} as const;
