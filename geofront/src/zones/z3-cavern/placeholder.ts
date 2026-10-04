/**
 * z3-cavern placeholder: the GeoFront itself. Dome with light collectors, forest floor,
 * lake, the inverted city hanging from the ceiling, the two-tier pyramid (HERO LOD set)
 * and the cartrain viaduct from the tunnel mouth down to the plaza.
 */
import { MathUtils } from 'three';
import { CAVERN_LAYOUT, FOREST, INVERTED_CITY, LIGHT_COLLECTORS, PYRAMID_LAYOUT, VIADUCT, Z3_LINGER } from '../../config/layout/cavern';
import { CONSTRUCTION } from '../../config/layout/common';
import { CAVERN, PYRAMID } from '../../config/scale';
import type { Poi } from '../../contracts/manifest';
import { CAVERN_RADIUS_M, ceilingAt, TUNNEL_MOUTH, VIADUCT_TERMINUS } from '../kit/anchors';
import { lerp3, merged, meshNode, mm, poi, slabBetween, trigger, tuple } from '../kit/nodes';
import { terminal } from '../kit/pieces';
import { between, createRng } from '../kit/rng';
import type { GeometryPart, NodeSpec, Vec3, ZoneSpec } from '../kit/spec';

const YAW_EAST = -90;
const YAW_NORTH = 0;
const FULL_TURN_DEG = 360;
const HALF_TURN_DEG = 180;
const PILLAR_SEGMENTS = 12;
const TREE_SEGMENTS = 7;
const COLLECTOR_SEGMENTS = 24;
/** Minimum pillar height worth modelling, m. */
const MIN_PILLAR_M = 2;
/** Buildings are sunk this far into the ceiling so their tops never show, m. */
const CEILING_EMBED_M = 8;
/** Trees keep this far from the lake shore, m. */
const SHORE_CLEARANCE_M = 25;
/** Collectors sit just below the dome surface, m. */
const COLLECTOR_INSET_M = 1;

function lakeCentre(): Vec3 {
  const b = MathUtils.degToRad(CAVERN_LAYOUT.lakeBearingDeg);
  return [CAVERN.lakeOffsetM * Math.cos(b), 0, -CAVERN.lakeOffsetM * Math.sin(b)];
}

function pyramidLevel(name: string): NodeSpec {
  const lowerTop = PYRAMID.baseM * (1 - PYRAMID_LAYOUT.lowerTierHeightM / PYRAMID.heightM);
  const children: readonly NodeSpec[] = [
    meshNode('lower', 'pyramidBase', { kind: 'frustum', base: PYRAMID.baseM, top: lowerTop, height: PYRAMID_LAYOUT.lowerTierHeightM }),
    meshNode('upper', 'pyramidGlass', { kind: 'pyramid', base: lowerTop, height: PYRAMID.heightM - PYRAMID_LAYOUT.lowerTierHeightM }, [0, PYRAMID_LAYOUT.lowerTierHeightM, 0]),
  ];
  return { name, children };
}

export function buildZ3Cavern(): ZoneSpec {
  const rng = createRng(CAVERN_LAYOUT.seed);
  const lake = lakeCentre();

  // Forest: unit cone (height 1, base at y = 0) instanced at points on the floor.
  const trees: NodeSpec[] = [];
  while (trees.length < FOREST.count) {
    const r = Math.sqrt(between(rng, (FOREST.clearRadiusM / CAVERN_RADIUS_M) ** 2, (FOREST.outerRadiusM / CAVERN_RADIUS_M) ** 2)) * CAVERN_RADIUS_M;
    const a = between(rng, 0, Math.PI * 2);
    const x = r * Math.cos(a);
    const z = r * Math.sin(a);
    const h = between(rng, FOREST.heightMinM, FOREST.heightMaxM);
    const nearViaduct = x < 0 && Math.abs(z) < FOREST.viaductClearanceM;
    const inLake = Math.hypot(x - lake[0], z - lake[2]) < CAVERN.lakeRadiusM + SHORE_CLEARANCE_M;
    if (nearViaduct || inLake) continue;
    trees.push({ name: `t${trees.length}`, position: [mm(x), 0, mm(z)], rotationDeg: [0, mm(between(rng, 0, FULL_TURN_DEG)), 0], scale: [mm(h), mm(h), mm(h)] });
  }

  // Inverted city: three box variants, unit size, hanging down from their anchor point.
  const cityVariants = ['a', 'b', 'c'] as const;
  const cityNodes: NodeSpec[] = [];
  for (const v of cityVariants) {
    const points: NodeSpec[] = [];
    for (let i = 0; i < INVERTED_CITY.countPerVariant; i++) {
      const r = Math.sqrt(between(rng, (INVERTED_CITY.innerRadiusM / CAVERN_RADIUS_M) ** 2, (INVERTED_CITY.outerRadiusM / CAVERN_RADIUS_M) ** 2)) * CAVERN_RADIUS_M;
      const a = between(rng, 0, Math.PI * 2);
      const w = between(rng, INVERTED_CITY.footprintMinM, INVERTED_CITY.footprintMaxM);
      const d = between(rng, INVERTED_CITY.footprintMinM, INVERTED_CITY.footprintMaxM);
      const len = between(rng, INVERTED_CITY.lengthMinM, INVERTED_CITY.lengthMaxM);
      points.push({
        name: `b${i}`,
        position: [mm(r * Math.cos(a)), mm(ceilingAt(r) + CEILING_EMBED_M), mm(r * Math.sin(a))],
        rotationDeg: [0, mm(between(rng, 0, HALF_TURN_DEG)), 0],
        scale: [mm(w), mm(len + CEILING_EMBED_M), mm(d)],
      });
    }
    cityNodes.push(
      meshNode(`INST_building_${v}`, 'facade', { kind: 'merged', parts: [{ geometry: { kind: 'box', size: [1, 1, 1] }, position: [0, -1 / 2, 0] }] }),
      { name: `PTS_building_${v}`, children: points },
    );
  }

  // Light collectors on the ceiling, and the light placements code reads for god rays.
  const collectors: GeometryPart[] = [];
  const collectorLights: NodeSpec[] = [];
  for (let i = 0; i < LIGHT_COLLECTORS.count; i++) {
    const a = (i / LIGHT_COLLECTORS.count) * Math.PI * 2;
    const p: Vec3 = [
      LIGHT_COLLECTORS.ringRadiusM * Math.cos(a),
      ceilingAt(LIGHT_COLLECTORS.ringRadiusM) - COLLECTOR_INSET_M,
      LIGHT_COLLECTORS.ringRadiusM * Math.sin(a),
    ];
    collectors.push({ geometry: { kind: 'disc', radius: LIGHT_COLLECTORS.radiusM, segments: COLLECTOR_SEGMENTS }, position: p, rotationDeg: [HALF_TURN_DEG, 0, 0] });
    collectorLights.push({ name: `LGT_shaft_${String(i + 1).padStart(2, '0')}`, position: tuple(p) });
  }

  // Viaduct: deck, railings and pillars from the tunnel mouth to the terminus.
  const mouth = TUNNEL_MOUTH;
  const end = VIADUCT_TERMINUS;
  const length = Math.hypot(end[0] - mouth[0], end[1] - mouth[1]);
  const deck = slabBetween(mouth, end, VIADUCT.deckWidthM, VIADUCT.deckThicknessM);
  const edge = VIADUCT.deckWidthM / 2 - CONSTRUCTION.railingThicknessM / 2;
  const rails = [-1, 1].map((s) =>
    slabBetween([mouth[0], mouth[1], s * edge], [end[0], end[1], s * edge], CONSTRUCTION.railingThicknessM, CONSTRUCTION.railingHeightM, CONSTRUCTION.railingHeightM),
  );
  const pillars: GeometryPart[] = [];
  for (let d = VIADUCT.pillarSpacingM; d < length; d += VIADUCT.pillarSpacingM) {
    const p = lerp3(mouth, end, d / length);
    const h = p[1] - VIADUCT.deckThicknessM;
    if (h < MIN_PILLAR_M) continue;
    pillars.push({
      geometry: { kind: 'cylinder', radiusTop: VIADUCT.pillarRadiusM, radiusBottom: VIADUCT.pillarRadiusM, height: h, segments: PILLAR_SEGMENTS },
      position: [p[0], h / 2, p[2]],
    });
  }

  const along = (distance: number) => lerp3(mouth, end, distance / length);
  const terminalFloor = along(VIADUCT.terminalDistanceM);
  const z3Terminal = terminal('z3-cavern', [terminalFloor[0], terminalFloor[1], -(VIADUCT.deckWidthM / 2 - CONSTRUCTION.terminalStandOffM)], YAW_NORTH, Z3_LINGER.terminalSec);
  const floorDisc = { kind: 'disc', radius: CAVERN_RADIUS_M, segments: CAVERN_LAYOUT.floorSegments } as const;

  const nodes: NodeSpec[] = [
    meshNode('GEO_cavern_dome', 'rock', { kind: 'dome', radius: CAVERN_RADIUS_M, height: CAVERN.heightM, segments: CAVERN_LAYOUT.domeSegments, rings: CAVERN_LAYOUT.domeRings, inward: true }),
    meshNode('GEO_cavern_floor', 'ground', { ...floorDisc, holes: [{ x: lake[0], z: lake[2], radius: CAVERN.lakeRadiusM }] }),
    meshNode('GEO_lake', 'water', { kind: 'disc', radius: CAVERN.lakeRadiusM, segments: CAVERN_LAYOUT.floorSegments }, [lake[0], CAVERN.lakeSurfaceElevationM, lake[2]]),
    meshNode(
      'GEO_lake_shore',
      'rock',
      { kind: 'cylinder', radiusTop: CAVERN.lakeRadiusM, radiusBottom: CAVERN.lakeRadiusM, height: CAVERN_LAYOUT.lakeShoreDropM, segments: CAVERN_LAYOUT.floorSegments, openEnded: true, inward: true },
      [lake[0], -CAVERN_LAYOUT.lakeShoreDropM / 2, lake[2]],
    ),
    meshNode('INST_tree', 'foliage', {
      kind: 'merged',
      parts: [{ geometry: { kind: 'cylinder', radiusTop: 0, radiusBottom: FOREST.radiusRatio, height: 1, segments: TREE_SEGMENTS }, position: [0, 1 / 2, 0] }],
    }),
    { name: 'PTS_tree', children: trees },
    ...cityNodes,
    merged('GEO_light_collectors', 'lightCollector', collectors),
    ...collectorLights,
    pyramidLevel('HERO_pyramid_LOD0'),
    pyramidLevel('HERO_pyramid_LOD1'),
    pyramidLevel('HERO_pyramid_LOD2'),
    merged('GEO_viaduct', 'concrete', [deck, ...pillars]),
    merged('GEO_viaduct_rails', 'steel', rails),
    ...z3Terminal.nodes,
    merged('COL_viaduct', 'concrete', [deck, ...rails]),
    meshNode('COL_cavern_floor', 'ground', floorDisc),
    poi('POI_cavern_reveal', along(VIADUCT.revealDistanceM), YAW_EAST, VIADUCT.revealPitchDeg),
    poi('POI_viaduct_mid', along(length / 2), YAW_EAST),
    trigger(
      'TRG_rail_terminus',
      [end[0] - CONSTRUCTION.triggerHalfDepthM, end[1] + VIADUCT.deckWidthM / 2, end[2]],
      [CONSTRUCTION.triggerHalfDepthM, VIADUCT.deckWidthM / 2, VIADUCT.deckWidthM / 2],
    ),
  ];
  const pois: Poi[] = [
    { id: 'poi-cavern-reveal', node: 'POI_cavern_reveal', lingerSec: Z3_LINGER.revealSec },
    { id: 'poi-viaduct-mid', node: 'POI_viaduct_mid', lingerSec: Z3_LINGER.midpointSec },
    z3Terminal.poi,
  ];
  return {
    id: 'z3-cavern',
    nodes,
    manifest: {
      id: 'z3-cavern',
      glb: 'z3-cavern.glb',
      next: 'z4-pyramid',
      prev: 'z2-descent',
      spawn: { position: tuple(along(CONSTRUCTION.triggerHalfDepthM * 2)), yawDeg: YAW_EAST },
      guidedPath: null,
      transition: { type: 'vehicle', triggerNode: 'TRG_rail_terminus' },
      ambience: [],
      reverb: null,
      pois,
      alsoVisible: ['z4-pyramid'],
    },
    scaleChecks: [
      { node: 'GEO_cavern_dome', axis: 'x', expectedM: CAVERN.diameterM, tolerance: 0.01 },
      { node: 'GEO_cavern_dome', axis: 'y', expectedM: CAVERN.heightM, tolerance: 0.01 },
      { node: 'HERO_pyramid_LOD1', axis: 'x', expectedM: PYRAMID.baseM, tolerance: 0.01 },
      { node: 'HERO_pyramid_LOD1', axis: 'y', expectedM: PYRAMID.heightM, tolerance: 0.01 },
    ],
  };
}
