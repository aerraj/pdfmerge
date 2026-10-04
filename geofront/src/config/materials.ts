/**
 * Placeholder PBR materials for greybox zones. Colours come from the palette; roughness,
 * metalness and emissive strength are ratios. Real materials replace these with the
 * approved GLBs; nothing in code refers to a placeholder material by value.
 */
import { PALETTE } from './palette';

export interface PlaceholderMaterial {
  /** Base colour, sRGB hex. */
  color: number;
  roughness: number;
  metalness: number;
  /** Emissive colour, sRGB hex. */
  emissive?: number;
  /** Emissive intensity multiplier (KHR_materials_emissive_strength). */
  emissiveStrength?: number;
  /** Render both faces (thin shells seen from either side). */
  doubleSided?: boolean;
}

export const PLACEHOLDER_MATERIALS = {
  /** Road surface, ratio. [tuned] */
  asphalt: { color: PALETTE.asphalt, roughness: 0.92, metalness: 0 },
  /** Pavements, kerbs, structural concrete, ratio. [tuned] */
  concrete: { color: PALETTE.concrete, roughness: 0.85, metalness: 0 },
  /** Tokyo-3 building facades, ratio. [tuned] */
  facade: { color: PALETTE.industrialGrey, roughness: 0.7, metalness: 0.2 },
  /** NERV interior walls and ceilings, ratio. [tuned] */
  interior: { color: PALETTE.industrialGrey, roughness: 0.6, metalness: 0.1 },
  /** Interior floors, ratio. [tuned] */
  floor: { color: PALETTE.darkSteel, roughness: 0.55, metalness: 0.2 },
  /** Machinery, rails, railings, pillars, ratio. [tuned] */
  steel: { color: PALETTE.darkSteel, roughness: 0.4, metalness: 0.8 },
  /** NERV red trim and signage panels, ratio. [tuned] */
  nervRed: { color: PALETTE.nervRed, roughness: 0.5, metalness: 0.1, emissive: PALETTE.nervRed, emissiveStrength: 0.4 },
  /** Hazard stripes, ratio. [tuned] */
  hazard: { color: PALETTE.hazardYellow, roughness: 0.6, metalness: 0 },
  /** Cavern rock (dome and walls), ratio. [tuned] */
  rock: { color: PALETTE.concrete, roughness: 1, metalness: 0 },
  /** GeoFront forest floor, ratio. [tuned] */
  ground: { color: PALETTE.forest, roughness: 1, metalness: 0 },
  /** Placeholder tree canopies, ratio. [tuned] */
  foliage: { color: PALETTE.forest, roughness: 0.9, metalness: 0 },
  /** Lake surface, ratio. [tuned] */
  water: { color: PALETTE.lake, roughness: 0.08, metalness: 0 },
  /** Cage coolant surface, ratio. [tuned] */
  coolant: { color: PALETTE.coolant, roughness: 0.15, metalness: 0, emissive: PALETTE.coolant, emissiveStrength: 0.15 },
  /** Pyramid lower tier, ratio. [tuned] */
  pyramidBase: { color: PALETTE.concrete, roughness: 0.5, metalness: 0.3 },
  /** Pyramid upper glass tier, ratio. [tuned] */
  pyramidGlass: { color: PALETTE.screenBlack, roughness: 0.12, metalness: 0.6 },
  /** Dark glass (control window, phone booth), ratio. [tuned] */
  glass: { color: PALETTE.screenBlack, roughness: 0.05, metalness: 0.5, doubleSided: true },
  /** Live terminal screens (SCR_ meshes) before the terminal system draws on them, ratio. [tuned] */
  screen: { color: PALETTE.screenBlack, roughness: 0.3, metalness: 0, emissive: PALETTE.screenGreen, emissiveStrength: 0.6 },
  /** Ceiling light strips and shaft lights, ratio. [tuned] */
  lightStrip: { color: 0xffffff, roughness: 0.5, metalness: 0, emissive: 0xfff1d6, emissiveStrength: 4 },
  /** Surface light collectors in the cavern ceiling, ratio. [tuned] */
  lightCollector: { color: 0xffffff, roughness: 0.5, metalness: 0, emissive: PALETTE.cavernHaze, emissiveStrength: 8 },
  /** Warning beacons, ratio. [tuned] */
  beacon: { color: PALETTE.displayOrange, roughness: 0.4, metalness: 0, emissive: PALETTE.displayOrange, emissiveStrength: 3 },
} as const satisfies Record<string, PlaceholderMaterial>;

export type PlaceholderMaterialKey = keyof typeof PLACEHOLDER_MATERIALS;
