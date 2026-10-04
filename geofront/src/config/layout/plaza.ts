/** Pyramid arrival (z4-pyramid): plaza, checkpoint and gate on the pyramid's west face. */
export const PLAZA = {
  /** Plaza width across the approach, m. [est] */
  widthM: 100,
  /** Plaza slab thickness, m. [est] */
  slabThicknessM: 0.5,
  /** Checkpoint distance west of the pyramid face, m. [est] */
  checkpointDistanceM: 120,
  /** Guard booth footprint (width along the road, depth), m. [est] */
  boothWidthM: 4,
  /** Booth depth, m. [est] */
  boothDepthM: 3,
  /** Guard booth height, m. [est] */
  boothHeightM: 3,
  /** Booth offset north of the road centreline, m. [est] */
  boothOffsetM: 9,
  /** Barrier arm length, height and thickness, m. [real] typical boom gate. */
  barrierLengthM: 7,
  /** Barrier height, m. [real] */
  barrierHeightM: 1,
  /** Barrier thickness, m. [real] */
  barrierThicknessM: 0.12,
  /** Gate portal structure protruding from the pyramid face: width, height and depth, m. [est] */
  portalWidthM: 24,
  /** Portal height, m. [est] */
  portalHeightM: 12,
  /** Portal depth, m. [est] */
  portalDepthM: 12,
  /** Card reader offset outside the gate opening and its mounting height, m. [anthro] at an adult's hand height. */
  cardReaderSideOffsetM: 1.2,
  /** Card reader height, m. [anthro] */
  cardReaderHeightM: 1.2,
  /** Card reader size (width, height, depth), m. [real] */
  cardReaderSizeM: 0.2,
  /** Warning beacon size, m. [est] */
  beaconSizeM: 0.6,
  /** Where the car stops and Shinji gets out, distance from the viaduct terminus, m. [tuned] */
  arrivalDistanceM: 20,
} as const;

/** Guided linger at z4 points of interest, s. [tuned] */
export const Z4_LINGER = {
  arrivalSec: 3,
  checkpointSec: 4,
  cardReaderSec: 4,
  terminalSec: 0,
} as const;
