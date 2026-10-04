/** Construction sizes shared by every greybox zone. */
export const CONSTRUCTION = {
  /** Interior wall thickness, m. [est] reinforced concrete partition. */
  wallThicknessM: 0.4,
  /** Floor and ceiling slab thickness, m. [est] */
  slabThicknessM: 0.4,
  /** Guard-rail height along drops, m. [real] building-code minimum is 1.1 m. */
  railingHeightM: 1.1,
  /** Guard-rail thickness, m. [est] */
  railingThicknessM: 0.1,
  /** Ceiling light strip size (width, depth), m. [est] */
  lightStripWidthM: 0.3,
  /** Ceiling light strip length, m. [est] */
  lightStripLengthM: 2.4,
  /** Spacing of ceiling light strips along corridors, m. [est] */
  lightStripSpacingM: 4,
  /** Terminal screen width, m. [est] wall-mounted console screen. */
  terminalWidthM: 0.9,
  /** Terminal screen height, m. [est] */
  terminalHeightM: 0.6,
  /** Height of a terminal screen's centre above its floor, m. [anthro] comfortable for a 1.50 m eye height. */
  terminalCentreHeightM: 1.35,
  /** Distance from a terminal at which the Esc walk stops, m. [anthro] arm's length. */
  terminalStandOffM: 0.8,
  /** Depth of the console body behind a screen, m. [est] */
  terminalDepthM: 0.15,
  /** Half thickness of transition trigger volumes along the direction of travel, m. [tuned] */
  triggerHalfDepthM: 1.5,
} as const;
