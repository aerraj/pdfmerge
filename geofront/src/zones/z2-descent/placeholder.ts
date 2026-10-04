/**
 * z2-descent placeholder: the dark inclined cartrain shaft from the station hall down
 * through the crust to the mouth in the cavern wall, with light bands streaking past.
 */
import { CONSTRUCTION } from '../../config/layout/common';
import { SHAFT, Z2_LINGER } from '../../config/layout/shaft';
import { CARTRAIN_LINE } from '../../config/world';
import type { Poi } from '../../contracts/manifest';
import { SHAFT_HEAD, TUNNEL_MOUTH } from '../kit/anchors';
import { lerp3, merged, poi, segmentedSlabBetween, slabBetween, trigger, tuple } from '../kit/nodes';
import { terminal } from '../kit/pieces';
import type { GeometryPart, NodeSpec, Vec3, ZoneSpec } from '../kit/spec';

const YAW_EAST = -90;
const YAW_NORTH = 0;
const LIGHT_STRIP_DEPTH_M = 0.15;
const LIGHT_STRIP_HEIGHT_M = 0.4;

export function buildZ2Descent(): ZoneSpec {
  const head = SHAFT_HEAD;
  const mouth = TUNNEL_MOUTH;
  const length = Math.hypot(mouth[0] - head[0], mouth[1] - head[1]);
  const lining = SHAFT.liningThicknessM;
  const halfW = SHAFT.widthM / 2;
  const side = (p: Vec3, dz: number): Vec3 => [p[0], p[1], p[2] + dz];
  const pitch = -CARTRAIN_LINE.shaftInclineDeg;

  const floor = slabBetween(head, mouth, SHAFT.widthM + 2 * lining, lining);
  const ceiling = slabBetween(head, mouth, SHAFT.widthM + 2 * lining, lining, SHAFT.heightM + lining);
  const walls = [-1, 1].map((s) => slabBetween(side(head, s * (halfW + lining / 2)), side(mouth, s * (halfW + lining / 2)), lining, SHAFT.heightM, SHAFT.heightM));
  const rails = [-1, 1].map((s) =>
    slabBetween(side(head, (s * SHAFT.railGaugeM) / 2), side(mouth, (s * SHAFT.railGaugeM) / 2), SHAFT.railSizeM, SHAFT.railSizeM, SHAFT.railSizeM),
  );

  // Light bands on both walls; the descent reads as speed through them.
  const lights: GeometryPart[] = [];
  const count = Math.floor(length / SHAFT.lightSpacingM);
  for (let i = 0; i < count; i++) {
    const t0 = (i * SHAFT.lightSpacingM) / length;
    const t1 = Math.min(1, t0 + SHAFT.lightLengthM / length);
    for (const s of [-1, 1]) {
      const z = s * (halfW - LIGHT_STRIP_DEPTH_M / 2);
      lights.push(slabBetween(side(lerp3(head, mouth, t0), z), side(lerp3(head, mouth, t1), z), LIGHT_STRIP_DEPTH_M, LIGHT_STRIP_HEIGHT_M, SHAFT.lightHeightM));
    }
  }

  const along = (distance: number) => lerp3(head, mouth, distance / length);
  const terminalFloor = side(along(SHAFT.terminalDistanceM), -(halfW - CONSTRUCTION.terminalDepthM));
  const z2Terminal = terminal('z2-descent', terminalFloor, YAW_NORTH, Z2_LINGER.terminalSec);
  const exitCentre: Vec3 = [mouth[0] - CONSTRUCTION.triggerHalfDepthM, mouth[1] + SHAFT.heightM / 2, 0];

  const nodes: NodeSpec[] = [
    merged('GEO_shaft_lining', 'concrete', [floor, ceiling, ...walls]),
    merged('GEO_cartrain_rails', 'steel', rails),
    merged('GEO_shaft_lights', 'lightStrip', lights),
    ...z2Terminal.nodes,
    merged('COL_shaft', 'concrete', [
      ...segmentedSlabBetween(head, mouth, SHAFT.widthM + 2 * lining, lining, 0, CONSTRUCTION.collisionSegmentM),
      ...[-1, 1].flatMap((s) =>
        segmentedSlabBetween(side(head, s * (halfW + lining / 2)), side(mouth, s * (halfW + lining / 2)), lining, SHAFT.heightM, SHAFT.heightM, CONSTRUCTION.collisionSegmentM),
      ),
    ]),
    poi('POI_pamphlet_handover', along(SHAFT.pamphletDistanceM), YAW_EAST, pitch),
    poi('POI_shaft_midpoint', along(length / 2), YAW_EAST, pitch),
    trigger('TRG_cartrain_exit', exitCentre, [CONSTRUCTION.triggerHalfDepthM, SHAFT.heightM / 2 + lining, halfW]),
  ];
  const pois: Poi[] = [
    { id: 'poi-pamphlet-handover', node: 'POI_pamphlet_handover', lingerSec: Z2_LINGER.pamphletSec },
    { id: 'poi-shaft-midpoint', node: 'POI_shaft_midpoint', lingerSec: Z2_LINGER.midpointSec },
    z2Terminal.poi,
  ];
  const run = mouth[0] - head[0];
  return {
    id: 'z2-descent',
    nodes,
    manifest: {
      id: 'z2-descent',
      glb: 'z2-descent.glb',
      next: 'z3-cavern',
      prev: 'z1-surface',
      spawn: { position: tuple(along(CONSTRUCTION.triggerHalfDepthM * 2)), yawDeg: YAW_EAST },
      guidedPath: null,
      transition: { type: 'vehicle', triggerNode: 'TRG_cartrain_exit' },
      ambience: [],
      reverb: null,
      pois,
      alsoVisible: ['z3-cavern'],
    },
    // The lining's horizontal run must match the incline through the crust.
    scaleChecks: [{ node: 'GEO_shaft_lining', axis: 'x', expectedM: run, tolerance: 0.02 }],
  };
}
