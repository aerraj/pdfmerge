/**
 * z4-pyramid placeholder: the plaza at the foot of the pyramid's west face, the guard
 * checkpoint with its barrier, and the gate portal with card reader, doors and beacons.
 */
import { CONSTRUCTION } from '../../config/layout/common';
import { PLAZA, Z4_LINGER } from '../../config/layout/plaza';
import { PYRAMID } from '../../config/scale';
import { INTERIOR_LEVELS } from '../../config/world';
import type { Poi } from '../../contracts/manifest';
import { PYRAMID_WEST_FACE_X, VIADUCT_TERMINUS } from '../kit/anchors';
import { boxPart, merged, poi, slabPart, trigger, tuple } from '../kit/nodes';
import { terminal } from '../kit/pieces';
import type { GeometryPart, NodeSpec, Vec3, ZoneSpec } from '../kit/spec';

const YAW_EAST = -90;
const YAW_NORTH = 0;
const YAW_SOUTH = 180;
/** Planter border height, m. */
const PLANTER_HEIGHT_M = 0.6;
const PLANTER_WIDTH_M = 1.2;

export function buildZ4Pyramid(): ZoneSpec {
  const y = INTERIOR_LEVELS.entranceElevationM;
  const face = PYRAMID_WEST_FACE_X;
  const west = VIADUCT_TERMINUS[0];
  const halfW = PLAZA.widthM / 2;
  const slab = slabPart(west, face, -halfW, halfW, y, PLAZA.slabThicknessM);

  // Planters frame the plaza on three sides, leaving the road open to the viaduct.
  const roadHalf = PYRAMID.gateWidthM;
  const planters: GeometryPart[] = [
    boxPart([(west + face) / 2, y + PLANTER_HEIGHT_M / 2, -halfW + PLANTER_WIDTH_M / 2], [face - west, PLANTER_HEIGHT_M, PLANTER_WIDTH_M]),
    boxPart([(west + face) / 2, y + PLANTER_HEIGHT_M / 2, halfW - PLANTER_WIDTH_M / 2], [face - west, PLANTER_HEIGHT_M, PLANTER_WIDTH_M]),
    boxPart([west + PLANTER_WIDTH_M / 2, y + PLANTER_HEIGHT_M / 2, -(halfW + roadHalf) / 2], [PLANTER_WIDTH_M, PLANTER_HEIGHT_M, halfW - roadHalf]),
    boxPart([west + PLANTER_WIDTH_M / 2, y + PLANTER_HEIGHT_M / 2, (halfW + roadHalf) / 2], [PLANTER_WIDTH_M, PLANTER_HEIGHT_M, halfW - roadHalf]),
  ];
  // Collision for planters is railing height so nobody steps over them.
  const planterCollision = planters.map((p) => {
    const [px, , pz] = p.position;
    const size = p.geometry.kind === 'box' ? p.geometry.size : ([0, 0, 0] as Vec3);
    return boxPart([px, y + CONSTRUCTION.railingHeightM / 2, pz], [size[0], CONSTRUCTION.railingHeightM, size[2]]);
  });

  // Checkpoint booth (north of the road) and barrier arm across it.
  const boothX = face - PLAZA.checkpointDistanceM;
  const booth = boxPart([boothX, y + PLAZA.boothHeightM / 2, -PLAZA.boothOffsetM], [PLAZA.boothWidthM, PLAZA.boothHeightM, PLAZA.boothDepthM]);
  const barrier = boxPart(
    [boothX, y + PLAZA.barrierHeightM, -PLAZA.boothOffsetM + PLAZA.boothDepthM / 2 + PLAZA.barrierLengthM / 2],
    [PLAZA.barrierThicknessM, PLAZA.barrierThicknessM, PLAZA.barrierLengthM],
  );

  // Gate portal protruding from the pyramid face, with the gate opening through it.
  const gateHalf = PYRAMID.gateWidthM / 2;
  const portalHalf = PLAZA.portalWidthM / 2;
  const px0 = face - PLAZA.portalDepthM;
  const sideWidth = portalHalf - gateHalf;
  const portalSides = [-1, 1].map((s) =>
    boxPart([face - PLAZA.portalDepthM / 2, y + PLAZA.portalHeightM / 2, s * (gateHalf + sideWidth / 2)], [PLAZA.portalDepthM, PLAZA.portalHeightM, sideWidth]),
  );
  const lintelHeight = PLAZA.portalHeightM - PYRAMID.gateHeightM;
  const lintel = boxPart([face - PLAZA.portalDepthM / 2, y + PYRAMID.gateHeightM + lintelHeight / 2, 0], [PLAZA.portalDepthM, lintelHeight, PYRAMID.gateWidthM]);
  // Doors stand open (slid into the portal sides) until the POI event system animates them.
  const doorThickness = CONSTRUCTION.wallThicknessM;
  const doors = [-1, 1].map((s) =>
    boxPart([face - doorThickness, y + PYRAMID.gateHeightM / 2, s * (gateHalf + gateHalf / 2)], [doorThickness, PYRAMID.gateHeightM, gateHalf]),
  );
  const readerZ = gateHalf + PLAZA.cardReaderSideOffsetM;
  const reader = boxPart([px0 - PLAZA.cardReaderSizeM / 2, y + PLAZA.cardReaderHeightM, -readerZ], [PLAZA.cardReaderSizeM, PLAZA.cardReaderSizeM, PLAZA.cardReaderSizeM]);
  const beaconPoints: Vec3[] = [-1, 1].map((s) => [px0, y + PLAZA.portalHeightM + PLAZA.beaconSizeM / 2, s * (portalHalf - PLAZA.beaconSizeM)]);

  const terminalFloor: Vec3 = [boothX, y, -PLAZA.boothOffsetM + PLAZA.boothDepthM / 2 + CONSTRUCTION.terminalDepthM];
  const z4Terminal = terminal('z4-pyramid', terminalFloor, YAW_NORTH, Z4_LINGER.terminalSec);
  const arrival: Vec3 = [west + PLAZA.arrivalDistanceM, y, 0];

  const nodes: NodeSpec[] = [
    merged('GEO_plaza', 'concrete', [slab]),
    merged('GEO_planters', 'foliage', planters),
    merged('GEO_checkpoint_booth', 'facade', [booth]),
    merged('GEO_barrier', 'hazard', [barrier]),
    merged('GEO_gate_portal', 'pyramidBase', [...portalSides, lintel]),
    merged('GEO_pyramid_doors', 'steel', doors),
    merged('GEO_card_reader', 'screen', [reader]),
    merged('GEO_gate_beacons', 'beacon', beaconPoints.map((p) => boxPart(p, [PLAZA.beaconSizeM, PLAZA.beaconSizeM, PLAZA.beaconSizeM]))),
    { name: 'LGT_gate_beacon_01', position: tuple(beaconPoints[0] ?? [0, 0, 0]) },
    { name: 'LGT_gate_beacon_02', position: tuple(beaconPoints[1] ?? [0, 0, 0]) },
    ...z4Terminal.nodes,
    merged('COL_plaza', 'concrete', [slab, ...planterCollision, booth, ...portalSides]),
    poi('POI_car_stop', arrival, YAW_EAST),
    poi('POI_checkpoint', [boothX, y, -PLAZA.boothOffsetM + PLAZA.boothDepthM / 2 + CONSTRUCTION.terminalStandOffM * 2], YAW_NORTH),
    poi('POI_card_reader', [px0 - CONSTRUCTION.terminalStandOffM, y, -readerZ], YAW_EAST),
    poi('POI_gate', [px0 - PLAZA.portalDepthM / 2, y, 0], YAW_EAST),
    poi('POI_mark_guard', [boothX + PLAZA.boothWidthM, y, -PLAZA.boothOffsetM], YAW_SOUTH),
    trigger(
      'TRG_pyramid_doors',
      [face + CONSTRUCTION.triggerHalfDepthM, y + PYRAMID.gateHeightM / 2, 0],
      [CONSTRUCTION.triggerHalfDepthM, PYRAMID.gateHeightM / 2, gateHalf],
    ),
  ];
  const pois: Poi[] = [
    { id: 'poi-car-stop', node: 'POI_car_stop', lingerSec: Z4_LINGER.arrivalSec },
    { id: 'poi-checkpoint', node: 'POI_checkpoint', lingerSec: Z4_LINGER.checkpointSec },
    {
      id: 'poi-card-reader',
      node: 'POI_card_reader',
      lingerSec: Z4_LINGER.cardReaderSec,
      event: { type: 'card', reader: 'GEO_card_reader', opens: 'GEO_pyramid_doors' },
    },
    { id: 'poi-gate', node: 'POI_gate', lingerSec: Z4_LINGER.cardReaderSec },
    z4Terminal.poi,
  ];
  return {
    id: 'z4-pyramid',
    nodes,
    manifest: {
      id: 'z4-pyramid',
      glb: 'z4-pyramid.glb',
      next: 'z5-corridors',
      prev: 'z3-cavern',
      spawn: { position: tuple(arrival), yawDeg: YAW_EAST },
      guidedPath: null,
      transition: { type: 'door', triggerNode: 'TRG_pyramid_doors' },
      ambience: [],
      reverb: null,
      pois,
      alsoVisible: ['z3-cavern'],
    },
    scaleChecks: [{ node: 'GEO_gate_portal', axis: 'z', expectedM: PLAZA.portalWidthM, tolerance: 0.01 }],
  };
}
