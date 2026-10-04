/** Tokyo-3 street (z1-surface): a straight street running west from the cartrain station. */
export const STREET = {
  /** Carriageway width, m. [est] two-lane street in ep01. */
  roadWidthM: 10,
  /** Pavement width on each side, m. [est] */
  pavementWidthM: 4,
  /** Kerb height, m. [real] typical Japanese kerb. */
  kerbHeightM: 0.15,
  /** Street modelled west of the station portal, m. [tuned] reads as a street, stays inside the budget. */
  lengthM: 220,
  /** Where Shinji waits, distance west of the station portal, m. [tuned] the car's approach is visible for seconds. */
  waitDistanceM: 120,
  /** Depth of building blocks behind the pavement, m. [est] */
  blockDepthM: 18,
  /** Shortest building frontage, m. [est] */
  blockFrontageMinM: 12,
  /** Longest building frontage, m. [est] */
  blockFrontageMaxM: 28,
  /** Lowest building, m. [est] mid-rise Tokyo-3 blocks around the station. */
  blockHeightMinM: 15,
  /** Tallest building, m. [est] */
  blockHeightMaxM: 60,
  /** Gap between neighbouring buildings, m. [est] */
  blockGapM: 3,
  /** Utility pole spacing along the pavement, m. [real] Japanese poles stand 30–40 m apart. */
  poleSpacingM: 32,
  /** Utility pole height, m. [real] */
  poleHeightM: 10,
  /** Utility pole radius at the base, m. [real] */
  poleRadiusM: 0.18,
  /** Pole top radius as a fraction of the base, ratio. [real] concrete poles taper. */
  poleTaperRatio: 0.8,
  /** Overhead wire thickness, m. [est] exaggerated so it survives distance. */
  wireThicknessM: 0.05,
  /** Seed for building and pole variation, count. [tuned] */
  seed: 3,
} as const;

/** The phone booth beside Shinji's waiting spot. */
export const PHONE_BOOTH = {
  /** Offset west of the waiting spot along the pavement, m. [tuned] */
  offsetWestM: 6,
  /** Footprint width and depth, m. [real] Japanese phone booth. */
  sizeM: 1,
  /** Height, m. [real] */
  heightM: 2.2,
} as const;

/** Station building over the top of the cartrain shaft. */
export const STATION = {
  /** Hall length from the portal to the head of the shaft, m. [est] */
  hallLengthM: 40,
  /** Hall width, m. [est] room for the car carrier and a walkway. */
  hallWidthM: 16,
  /** Hall height, m. [est] equal to the shaft's clear height so the two meet flush. */
  hallHeightM: 10,
  /** Vehicle portal width, m. [est] */
  portalWidthM: 8,
  /** Vehicle portal height, m. [est] */
  portalHeightM: 5,
  /** Facade height above the street, m. [est] */
  facadeHeightM: 14,
  /** Distance of the cartrain boarding point from the portal, m. [tuned] */
  boardingDistanceM: 24,
} as const;

/** Where the setting sun's key light sits relative to the station portal, m. [est] low in the west. */
export const STREET_SUN = {
  westM: 900,
  upM: 140,
  northM: 260,
} as const;

/** Public information kiosk (z1's terminal) offset east of the waiting spot, m. [tuned] */
export const KIOSK = {
  offsetEastM: 4,
  /** Kiosk post radius, m. [est] */
  postRadiusM: 0.08,
} as const;

/** Guided linger at z1 points of interest, s. [tuned] */
export const Z1_LINGER = {
  phoneBoothSec: 4,
  misatoArrivalSec: 6,
  stationSec: 2,
  boardingSec: 3,
  terminalSec: 0,
} as const;
