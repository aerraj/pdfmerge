/** GeoFront cavern (z3-cavern): dome, floor, lake, forest, inverted city, pyramid, viaduct. */
export const CAVERN_LAYOUT = {
  /** Dome tessellation around and from rim to apex, count. [tuned] detail comes from fog and light, not geometry. */
  domeSegments: 72,
  /** Dome rings, count. [tuned] */
  domeRings: 18,
  /** Floor disc tessellation, count. [tuned] */
  floorSegments: 96,
  /** Bearing of the lake from the cavern centre, from +X towards north (-Z), deg. [est] beyond the pyramid, seen at the reveal. */
  lakeBearingDeg: 20,
  /** Lake bed depth below the floor at the shore, m. [est] */
  lakeShoreDropM: 2,
  /** Seed for forest and city scatter, count. [tuned] */
  seed: 11,
} as const;

/** Placeholder forest (instanced cones). */
export const FOREST = {
  /** Trees scattered, count. [tuned] placeholder density; T3.2 replaces with dense instancing and impostors. */
  count: 600,
  /** Clear radius around the pyramid and plaza, m. [est] */
  clearRadiusM: 700,
  /** Outermost ring of trees, m. [est] stays inside the cavern wall. */
  outerRadiusM: 2800,
  /** Half-width of the clearing along the viaduct, m. [est] */
  viaductClearanceM: 40,
  /** Tree height range, m. [real] mature broadleaf trees. */
  heightMinM: 12,
  /** Height max, m. [real] */
  heightMaxM: 26,
  /** Canopy radius as a fraction of height, ratio. [est] */
  radiusRatio: 0.3,
} as const;

/** Inverted Tokyo-3 skyscrapers hanging from the cavern ceiling. */
export const INVERTED_CITY = {
  /** Buildings per kit variant (three variants), count. [tuned] placeholder density. */
  countPerVariant: 70,
  /** Inner and outer radius of the hanging city, m. [est] ep01 shows the city over the central cavern. */
  innerRadiusM: 250,
  /** Outer radius of the hanging city, m. [est] */
  outerRadiusM: 2000,
  /** Hanging length range, m. [est] retracted Tokyo-3 high-rises. */
  lengthMinM: 60,
  /** Length max, m. [est] */
  lengthMaxM: 220,
  /** Footprint range, m. [est] */
  footprintMinM: 20,
  /** Footprint max, m. [est] */
  footprintMaxM: 45,
} as const;

/** Surface light collectors in the cavern ceiling (sources of the god rays). */
export const LIGHT_COLLECTORS = {
  /** Number of collectors, count. [est] */
  count: 8,
  /** Ring radius on which they sit, m. [est] */
  ringRadiusM: 1600,
  /** Radius of each collector opening, m. [est] */
  radiusM: 45,
} as const;

/** The two-tier pyramid as seen from the cavern (HERO_pyramid LOD set). */
export const PYRAMID_LAYOUT = {
  /** Height of the lower (light) tier, m. [est] the series draws a pale base under a dark glass upper section. */
  lowerTierHeightM: 120,
} as const;

/** Cartrain viaduct from the tunnel mouth down to the pyramid plaza. */
export const VIADUCT = {
  /** Deck width, m. [est] */
  deckWidthM: 10,
  /** Deck thickness, m. [est] */
  deckThicknessM: 1.5,
  /** Pillar spacing, m. [est] */
  pillarSpacingM: 60,
  /** Pillar radius, m. [est] */
  pillarRadiusM: 2.5,
  /** Terminus distance from the pyramid centre, m. [est] the line reaches ground just west of the plaza. */
  terminusDistanceM: 520,
  /** Where the reveal hold happens, distance from the tunnel mouth along the deck, m. [tuned] clear of the mouth's shadow. */
  revealDistanceM: 80,
  /** Downward tilt of the view at the reveal, deg. [tuned] the pyramid and lake sit below the horizon from the wall. */
  revealPitchDeg: -12,
  /** Where the maintenance terminal stands, distance from the mouth, m. [tuned] */
  terminalDistanceM: 20,
} as const;

/** Guided linger at z3 points of interest, s. [doc] the reveal holds at least 5 s. */
export const Z3_LINGER = {
  revealSec: 6,
  midpointSec: 0,
  terminalSec: 0,
} as const;
