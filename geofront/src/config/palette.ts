/**
 * Series palette (design doc, "Art direction"): saturated sunset oranges, cold
 * industrial greys, green-black screens. Colours are sRGB hex. [est] picks from ep01
 * frames, to be re-sampled from the reference boards.
 */
export const PALETTE = {
  /** Tokyo-3 evening sky and light-shaft warmth, sRGB hex. [est] */
  sunsetOrange: 0xe8743b,
  /** Cavern sky-dome fill, sRGB hex. [est] */
  cavernHaze: 0xd99a62,
  /** Bare concrete and rock, sRGB hex. [est] */
  concrete: 0x8a8a84,
  /** Cold industrial grey of NERV interiors, sRGB hex. [est] */
  industrialGrey: 0x5b6068,
  /** Dark steel and machinery, sRGB hex. [est] */
  darkSteel: 0x2c3036,
  /** Road asphalt, sRGB hex. [est] */
  asphalt: 0x3a3a3c,
  /** NERV red (emblem, warning stripes), sRGB hex. [est] */
  nervRed: 0xc8102e,
  /** Hazard stripe yellow, sRGB hex. [est] */
  hazardYellow: 0xe6b422,
  /** Terminal screen background, sRGB hex. [est] green-black. */
  screenBlack: 0x0a140e,
  /** Terminal screen glyphs, sRGB hex. [est] */
  screenGreen: 0x39ff88,
  /** Tactical display orange, sRGB hex. [est] */
  displayOrange: 0xff8a1c,
  /** Misato's Alpine A310 body, sRGB hex. [est] */
  misatoBlue: 0x2f5da8,
  /** Cage coolant, sRGB hex. [est] dark red-orange, lit from below. */
  coolant: 0x6b1f0e,
  /** GeoFront forest, sRGB hex. [est] */
  forest: 0x3d5a2a,
  /** Lake water, sRGB hex. [est] */
  lake: 0x26475a,
  /** Unit-01 armour purple, sRGB hex. [est] */
  unit01Purple: 0x5b3a8c,
  /** Unit-01 accent green, sRGB hex. [est] */
  unit01Green: 0x8ad13a,
  /** Unit-00 armour (prototype) orange, sRGB hex. [est] */
  unit00Orange: 0xd9822b,
  /** Unit-02 armour red, sRGB hex. [est] */
  unit02Red: 0xb3202a,
} as const;
