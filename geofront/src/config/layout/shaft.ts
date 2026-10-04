/** Cartrain shaft (z2-descent): the inclined tunnel from the station hall to the cavern wall. */
export const SHAFT = {
  /** Clear width, m. [est] carrier plus maintenance walkways. */
  widthM: 14,
  /** Clear height, m. [est] */
  heightM: 10,
  /** Lining thickness, m. [est] */
  liningThicknessM: 1,
  /** Spacing of the wall light strips that streak past during the descent, m. [est] ep01 shows regular light bands. */
  lightSpacingM: 25,
  /** Length of one light strip, m. [est] */
  lightLengthM: 6,
  /** Light strip height above the shaft floor, m. [est] */
  lightHeightM: 7,
  /** Rail gauge (distance between the two rails), m. [est] wide-gauge car carrier. */
  railGaugeM: 3,
  /** Rail cross-section, m. [est] */
  railSizeM: 0.25,
  /** Where Misato hands over the pamphlet, distance down the shaft, m. [tuned] */
  pamphletDistanceM: 60,
  /** Maintenance terminal distance down the shaft from its head, m. [tuned] */
  terminalDistanceM: 12,
} as const;

/** Guided linger at z2 points of interest, s. [tuned] */
export const Z2_LINGER = {
  pamphletSec: 8,
  midpointSec: 0,
  terminalSec: 0,
} as const;
