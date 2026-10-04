/**
 * z5-corridors placeholder: entrance hall inside the gate, a long corridor, two long
 * escalators with a turn between them (Misato gets lost), a junction where Ritsuko meets
 * them, and the lift lobby whose lift goes down to the cage.
 */
import { CONSTRUCTION } from '../../config/layout/common';
import { CORRIDORS, Z5_LINGER } from '../../config/layout/corridors';
import { CORRIDOR, ESCALATOR, PYRAMID } from '../../config/scale';
import type { Poi } from '../../contracts/manifest';
import { centreOf, CORRIDOR_PLAN } from '../kit/anchors';
import { boxPart, merged, poi, roomParts, slabBetween, trigger, tuple, type Rect, type RoomSpec } from '../kit/nodes';
import { lightStrips, terminal } from '../kit/pieces';
import type { GeometryPart, NodeSpec, Vec3, ZoneSpec } from '../kit/spec';

const YAW_EAST = -90;
const YAW_WEST = 90;
const YAW_SOUTH = 180;
const YAW_NORTH = 0;
const SIGN_DEPTH_M = 0.05;

interface Built {
  floor: GeometryPart[];
  shell: GeometryPart[];
  walls: GeometryPart[];
  lights: GeometryPart[];
}

function room(spec: RoomSpec, out: Built) {
  const parts = roomParts(spec, CONSTRUCTION.wallThicknessM, CONSTRUCTION.slabThicknessM);
  out.floor.push(...parts.floor);
  out.shell.push(...parts.ceiling, ...parts.walls);
  out.walls.push(...parts.walls);
  const [cx, cz] = [(spec.rect.x0 + spec.rect.x1) / 2, (spec.rect.z0 + spec.rect.z1) / 2];
  const alongX = spec.rect.x1 - spec.rect.x0 >= spec.rect.z1 - spec.rect.z0;
  const from: Vec3 = alongX ? [spec.rect.x0, 0, cz] : [cx, 0, spec.rect.z0];
  const to: Vec3 = alongX ? [spec.rect.x1, 0, cz] : [cx, 0, spec.rect.z1];
  out.lights.push(...lightStrips(from, to, spec.floorY + spec.height));
}

/** Inclined escalator tube: floor ramp, ceiling, side walls and visible steps. */
function escalatorTube(top: Vec3, bottom: Vec3, alongX: boolean, out: Built, steps: GeometryPart[]) {
  const w = CORRIDOR.widthM;
  const t = CONSTRUCTION.wallThicknessM;
  const slab = CONSTRUCTION.slabThicknessM;
  const h = CORRIDOR.heightM;
  const offset = (p: Vec3, d: number): Vec3 => (alongX ? [p[0], p[1], p[2] + d] : [p[0] + d, p[1], p[2]]);
  const ramp = slabBetween(top, bottom, w + 2 * t, slab);
  const ceiling = slabBetween(top, bottom, w + 2 * t, slab, h + slab);
  const walls = [-1, 1].map((s) => slabBetween(offset(top, s * (w / 2 + t / 2)), offset(bottom, s * (w / 2 + t / 2)), t, h, h));
  out.floor.push(ramp);
  out.shell.push(ceiling, ...walls);
  out.walls.push(...walls);
  // Steps (visual only) in a band down the middle; the ramp is the walking surface.
  const count = Math.round(ESCALATOR.riseM / ESCALATOR.stepRiseM);
  const riser = ESCALATOR.riseM / count;
  const run = alongX ? bottom[0] - top[0] : bottom[2] - top[2];
  const tread = run / count;
  for (let i = 0; i < count; i++) {
    const a = (i + 1 / 2) * tread;
    const y = top[1] - (i + 1) * riser + riser / 2;
    const centre: Vec3 = alongX ? [top[0] + a, y, top[2]] : [top[0], y, top[2] + a];
    steps.push(boxPart(centre, alongX ? [Math.abs(tread), riser, ESCALATOR.stepWidthM] : [ESCALATOR.stepWidthM, riser, Math.abs(tread)]));
  }
}

function sign(at: Vec3, alongX: boolean): GeometryPart {
  return boxPart(at, alongX ? [CORRIDORS.signWidthM, CORRIDORS.signHeightM, SIGN_DEPTH_M] : [SIGN_DEPTH_M, CORRIDORS.signHeightM, CORRIDORS.signWidthM]);
}

const mid = (r: Rect, y: number): Vec3 => {
  const [x, z] = centreOf(r);
  return [x, y, z];
};

export function buildZ5Corridors(): ZoneSpec {
  const p = CORRIDOR_PLAN;
  const [top, middle, bottom] = p.levels;
  const h = CORRIDOR.heightM;
  const w2 = CORRIDOR.widthM / 2;
  const out: Built = { floor: [], shell: [], walls: [], lights: [] };
  const steps: GeometryPart[] = [];
  const gate = PYRAMID.gateWidthM / 2;
  const [, cz] = centreOf(p.landing2);
  const [bx] = centreOf(p.corridorB);

  room(
    {
      rect: p.hall,
      floorY: top,
      height: CORRIDORS.hallHeightM,
      openings: [
        { side: 'west', from: -gate, to: gate, top: PYRAMID.gateHeightM },
        { side: 'east', from: -w2, to: w2, top: h },
      ],
    },
    out,
  );
  room({ rect: p.corridorA, floorY: top, height: h, open: ['west', 'east'] }, out);
  escalatorTube(p.escalator1.top, p.escalator1.bottom, true, out, steps);
  room({ rect: p.landing1, floorY: middle, height: h, openings: [{ side: 'west', from: -w2, to: w2 }, { side: 'south', from: bx - w2, to: bx + w2 }] }, out);
  room({ rect: p.corridorB, floorY: middle, height: h, open: ['north', 'south'] }, out);
  escalatorTube(p.escalator2.top, p.escalator2.bottom, false, out, steps);
  room({ rect: p.landing2, floorY: bottom, height: h, openings: [{ side: 'north', from: bx - w2, to: bx + w2 }, { side: 'east', from: cz - w2, to: cz + w2 }] }, out);
  room({ rect: p.corridorC1, floorY: bottom, height: h, open: ['west', 'east'] }, out);
  room({ rect: p.junction, floorY: bottom, height: h, openings: [{ side: 'west', from: cz - w2, to: cz + w2 }, { side: 'east', from: cz - w2, to: cz + w2 }] }, out);
  room({ rect: p.corridorC2, floorY: bottom, height: h, open: ['west', 'east'] }, out);
  const liftHalf = CORRIDORS.liftSizeM / 2;
  room({ rect: p.lobby, floorY: bottom, height: h, openings: [{ side: 'west', from: cz - w2, to: cz + w2 }, { side: 'east', from: cz - liftHalf, to: cz + liftHalf }] }, out);
  const liftParts = roomParts({ rect: p.lift, floorY: bottom, height: CORRIDORS.liftHeightM, open: ['west'] }, CONSTRUCTION.wallThicknessM, CONSTRUCTION.slabThicknessM);

  const signY = (floor: number) => floor + CORRIDORS.signHeightAboveFloorM;
  const signs = [
    sign([(p.corridorA.x0 + p.corridorA.x1) / 2, signY(top), -w2 + SIGN_DEPTH_M], true),
    sign([p.landing1.x1 - SIGN_DEPTH_M, signY(middle), (p.landing1.z0 + p.landing1.z1) / 2], false),
    sign([(p.junction.x0 + p.junction.x1) / 2, signY(bottom), p.junction.z0 + SIGN_DEPTH_M], true),
  ];

  const hallCentre = mid(p.hall, top);
  const z5Terminal = terminal('z5-corridors', [hallCentre[0], top, p.hall.z0 + CONSTRUCTION.terminalDepthM], YAW_NORTH, Z5_LINGER.terminalSec);
  const liftCentre = mid(p.lift, bottom);

  const nodes: NodeSpec[] = [
    merged('GEO_corridor_floor', 'floor', [...out.floor, ...liftParts.floor]),
    merged('GEO_corridor_shell', 'interior', out.shell),
    merged('GEO_corridor_lights', 'lightStrip', out.lights),
    merged('GEO_escalator_steps', 'steel', steps),
    merged('GEO_signage', 'nervRed', signs),
    merged('GEO_lift_car', 'steel', [...liftParts.walls, ...liftParts.ceiling]),
    ...z5Terminal.nodes,
    merged('COL_corridors', 'concrete', [...out.floor, ...out.walls, ...liftParts.floor, ...liftParts.walls]),
    poi('POI_entrance_hall', [p.hall.x0 + CORRIDORS.hallHeightM, top, 0], YAW_EAST),
    poi('POI_sign_corridor_a', mid(p.corridorA, top), YAW_EAST),
    poi('POI_escalator_1_top', p.escalator1.top, YAW_EAST, -ESCALATOR.inclineDeg),
    poi('POI_misato_lost', mid(p.landing1, middle), YAW_SOUTH),
    poi('POI_escalator_2_top', p.escalator2.top, YAW_SOUTH, -ESCALATOR.inclineDeg),
    poi('POI_ritsuko_meet', mid(p.junction, bottom), YAW_EAST),
    poi('POI_mark_ritsuko', [p.junction.x1 - CONSTRUCTION.terminalStandOffM * 2, bottom, cz], YAW_WEST),
    poi('POI_lift_lobby', mid(p.lobby, bottom), YAW_EAST),
    trigger('TRG_lift_cage', [liftCentre[0], bottom + h / 2, liftCentre[2]], [liftHalf - CONSTRUCTION.wallThicknessM, h / 2, liftHalf - CONSTRUCTION.wallThicknessM]),
  ];
  const pois: Poi[] = [
    { id: 'poi-entrance-hall', node: 'POI_entrance_hall', lingerSec: Z5_LINGER.hallSec },
    { id: 'poi-sign-corridor-a', node: 'POI_sign_corridor_a', lingerSec: Z5_LINGER.signSec },
    { id: 'poi-escalator-1-top', node: 'POI_escalator_1_top', lingerSec: Z5_LINGER.escalatorSec },
    { id: 'poi-misato-lost', node: 'POI_misato_lost', lingerSec: Z5_LINGER.lostSec },
    { id: 'poi-escalator-2-top', node: 'POI_escalator_2_top', lingerSec: Z5_LINGER.escalatorSec },
    { id: 'poi-ritsuko-meet', node: 'POI_ritsuko_meet', lingerSec: Z5_LINGER.ritsukoSec },
    { id: 'poi-lift-lobby', node: 'POI_lift_lobby', lingerSec: Z5_LINGER.lobbySec },
    z5Terminal.poi,
  ];
  return {
    id: 'z5-corridors',
    nodes,
    manifest: {
      id: 'z5-corridors',
      glb: 'z5-corridors.glb',
      next: 'z7-cage',
      prev: 'z4-pyramid',
      spawn: { position: tuple([p.hall.x0 + CONSTRUCTION.triggerHalfDepthM * 2, top, 0]), yawDeg: YAW_EAST },
      guidedPath: null,
      transition: { type: 'lift', triggerNode: 'TRG_lift_cage' },
      ambience: [],
      reverb: null,
      pois,
      alsoVisible: [],
    },
    scaleChecks: [{ node: 'GEO_lift_car', axis: 'z', expectedM: CORRIDORS.liftSizeM + 2 * CONSTRUCTION.wallThicknessM, tolerance: 0.01 }],
  };
}
