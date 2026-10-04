/**
 * World anchors derived from the scale and layout config. Several zones meet at these
 * points (the shaft head joins z1 and z2, the tunnel mouth joins z2 and z3, the lifts join
 * z5, z7 and z6), so they are computed once here rather than in each zone.
 */
import { MathUtils } from 'three';
import { CORRIDORS } from '../../config/layout/corridors';
import { CAGE_LAYOUT } from '../../config/layout/cage';
import { COMMAND_LAYOUT } from '../../config/layout/command';
import { VIADUCT } from '../../config/layout/cavern';
import { STATION } from '../../config/layout/street';
import { CAGE, CAVERN, CORRIDOR, ESCALATOR, PYRAMID } from '../../config/scale';
import { CARTRAIN_LINE, INTERIOR_LEVELS, STREET_ELEVATION_M } from '../../config/world';
import type { Rect } from './nodes';
import type { Vec3 } from './spec';

export const CAVERN_RADIUS_M = CAVERN.diameterM / 2;

/** Horizontal radius of the cavern wall at an elevation (ellipsoidal dome). */
export function cavernRadiusAt(elevationM: number): number {
  const t = elevationM / CAVERN.heightM;
  return CAVERN_RADIUS_M * Math.sqrt(Math.max(0, 1 - t * t));
}

/** Elevation of the cavern ceiling above a point at horizontal radius r. */
export function ceilingAt(radiusM: number): number {
  const t = radiusM / CAVERN_RADIUS_M;
  return CAVERN.heightM * Math.sqrt(Math.max(0, 1 - t * t));
}

const shaftRise = STREET_ELEVATION_M - CARTRAIN_LINE.tunnelMouthElevationM;
const shaftRun = shaftRise / Math.tan(MathUtils.degToRad(CARTRAIN_LINE.shaftInclineDeg));

/** Where the shaft breaks through the cavern wall (centre of the shaft floor). */
export const TUNNEL_MOUTH: Vec3 = [-cavernRadiusAt(CARTRAIN_LINE.tunnelMouthElevationM), CARTRAIN_LINE.tunnelMouthElevationM, 0];
/** Top of the shaft: east end of the station hall floor. */
export const SHAFT_HEAD: Vec3 = [TUNNEL_MOUTH[0] - shaftRun, STREET_ELEVATION_M, 0];
/** Vehicle portal in the station's west facade, on the street centreline. */
export const STATION_PORTAL: Vec3 = [SHAFT_HEAD[0] - STATION.hallLengthM, STREET_ELEVATION_M, 0];
/** Where the viaduct reaches the cavern floor, west of the plaza. */
export const VIADUCT_TERMINUS: Vec3 = [-VIADUCT.terminusDistanceM, 0, 0];
/** The pyramid's west face at ground level (x). */
export const PYRAMID_WEST_FACE_X = -PYRAMID.baseM / 2;

// ---- Interior chain: corridors (z5) → cage (z7) → command centre (z6) -----------------

const escalatorRun = ESCALATOR.riseM / Math.tan(MathUtils.degToRad(ESCALATOR.inclineDeg));
const halfWidth = CORRIDOR.widthM / 2;

export interface CorridorPlan {
  hall: Rect;
  corridorA: Rect;
  escalator1: { top: Vec3; bottom: Vec3 };
  landing1: Rect;
  corridorB: Rect;
  escalator2: { top: Vec3; bottom: Vec3 };
  landing2: Rect;
  corridorC1: Rect;
  junction: Rect;
  corridorC2: Rect;
  lobby: Rect;
  lift: Rect;
  /** Floor elevations of the upper, middle and lower levels, m. */
  levels: readonly [number, number, number];
}

function planCorridors(): CorridorPlan {
  const top = INTERIOR_LEVELS.entranceElevationM;
  const middle = top - ESCALATOR.riseM;
  const bottom = middle - ESCALATOR.riseM;
  const hall: Rect = CORRIDORS.hall;
  const corridorA: Rect = { x0: hall.x1, x1: hall.x1 + CORRIDORS.corridorALengthM, z0: -halfWidth, z1: halfWidth };
  const escalator1 = { top: [corridorA.x1, top, 0] as Vec3, bottom: [corridorA.x1 + escalatorRun, middle, 0] as Vec3 };
  const L = CORRIDORS.landingSizeM;
  const landing1: Rect = { x0: escalator1.bottom[0], x1: escalator1.bottom[0] + L, z0: -halfWidth, z1: -halfWidth + L };
  const bx = (landing1.x0 + landing1.x1) / 2;
  const corridorB: Rect = { x0: bx - halfWidth, x1: bx + halfWidth, z0: landing1.z1, z1: landing1.z1 + CORRIDORS.corridorBLengthM };
  const escalator2 = { top: [bx, middle, corridorB.z1] as Vec3, bottom: [bx, bottom, corridorB.z1 + escalatorRun] as Vec3 };
  const landing2: Rect = { x0: bx - L / 2, x1: bx + L / 2, z0: escalator2.bottom[2], z1: escalator2.bottom[2] + L };
  const cz = (landing2.z0 + landing2.z1) / 2;
  const corridorC1: Rect = { x0: landing2.x1, x1: landing2.x1 + CORRIDORS.corridorC1LengthM, z0: cz - halfWidth, z1: cz + halfWidth };
  const J = CORRIDORS.junctionSizeM / 2;
  const junction: Rect = { x0: corridorC1.x1, x1: corridorC1.x1 + CORRIDORS.junctionSizeM, z0: cz - J, z1: cz + J };
  const corridorC2: Rect = { x0: junction.x1, x1: junction.x1 + CORRIDORS.corridorC2LengthM, z0: cz - halfWidth, z1: cz + halfWidth };
  const lb = CORRIDORS.lobbySizeM / 2;
  const lobby: Rect = { x0: corridorC2.x1, x1: corridorC2.x1 + CORRIDORS.lobbySizeM, z0: cz - lb, z1: cz + lb };
  const ls = CORRIDORS.liftSizeM / 2;
  const lift: Rect = { x0: lobby.x1, x1: lobby.x1 + CORRIDORS.liftSizeM, z0: cz - ls, z1: cz + ls };
  return { hall, corridorA, escalator1, landing1, corridorB, escalator2, landing2, corridorC1, junction, corridorC2, lobby, lift, levels: [top, middle, bottom] };
}

export const CORRIDOR_PLAN = planCorridors();

/** Centre (x, z) of a rectangle. */
export const centreOf = (r: Rect): readonly [number, number] => [(r.x0 + r.x1) / 2, (r.z0 + r.z1) / 2];

export interface CagePlan {
  coolantY: number;
  bayFloorY: number;
  deckY: number;
  ceilingY: number;
  arrivalLift: Rect;
  commandLift: Rect;
  dock: Rect;
  channel: Rect;
  bays: readonly Rect[];
  gantry: Rect;
  walkway: Rect;
  enclosure: Rect;
  controlRoom: Rect;
  controlFloorY: number;
}

function planCage(): CagePlan {
  const coolantY = INTERIOR_LEVELS.cageCoolantElevationM;
  const [lx, lz] = centreOf(CORRIDOR_PLAN.lift);
  const ls = CORRIDORS.liftSizeM / 2;
  const arrivalLift: Rect = { x0: lx - ls, x1: lx + ls, z0: lz - ls, z1: lz + ls };
  const cx = lx + CAGE_LAYOUT.commandLiftOffsetEastM;
  const commandLift: Rect = { x0: cx - ls, x1: cx + ls, z0: lz - ls, z1: lz + ls };
  const dockSouth = arrivalLift.z0;
  const dock: Rect = { x0: lx - CAGE_LAYOUT.dockWestM, x1: lx + CAGE_LAYOUT.dockEastM, z0: dockSouth - CAGE_LAYOUT.dockDepthM, z1: dockSouth };
  const channelNorth = dock.z0 - CAGE.channelWidthM;
  const bayHalf = CAGE.bayWidthM / 2;
  const bays = [-1, 0, 1].map((i) => {
    const bx = lx + i * CAGE_LAYOUT.bayPitchM;
    return { x0: bx - bayHalf, x1: bx + bayHalf, z0: channelNorth - CAGE.bayLengthM, z1: channelNorth };
  });
  const first = bays[0];
  const last = bays[bays.length - 1];
  if (!first || !last) throw new Error('cage plan needs bays');
  const enclosure: Rect = {
    x0: first.x0 - CAGE_LAYOUT.enclosureMarginM,
    x1: last.x1 + CAGE_LAYOUT.enclosureMarginM,
    z0: first.z0,
    z1: dockSouth,
  };
  const channel: Rect = { x0: enclosure.x0, x1: enclosure.x1, z0: channelNorth, z1: dock.z0 };
  const gantry: Rect = { x0: first.x0, x1: last.x1, z0: channelNorth - CAGE_LAYOUT.gantryDepthM, z1: channelNorth };
  const wx = lx - CAGE_LAYOUT.walkwayOffsetWestM;
  const walkway: Rect = { x0: wx - CAGE_LAYOUT.walkwayWidthM / 2, x1: wx + CAGE_LAYOUT.walkwayWidthM / 2, z0: gantry.z1, z1: dock.z0 };
  const ww = CAGE_LAYOUT.windowWidthM / 2;
  const controlRoom: Rect = { x0: lx - ww, x1: lx + ww, z0: dockSouth, z1: dockSouth + CAGE_LAYOUT.controlRoomDepthM };
  return {
    coolantY,
    bayFloorY: coolantY - CAGE.depthM,
    deckY: coolantY + CAGE_LAYOUT.dockAboveCoolantM,
    ceilingY: coolantY + CAGE_LAYOUT.ceilingAboveCoolantM,
    arrivalLift,
    commandLift,
    dock,
    channel,
    bays,
    gantry,
    walkway,
    enclosure,
    controlRoom,
    controlFloorY: coolantY + CAGE.controlWindowSillM,
  };
}

export const CAGE_PLAN = planCage();

export interface CommandPlan {
  room: Rect;
  floorY: number;
  bridgeY: number;
  towerY: number;
  tower: Rect;
  bridge: Rect;
  pit: Rect;
  lift: Rect;
}

function planCommand(): CommandPlan {
  const room = COMMAND_LAYOUT.room;
  const floorY = INTERIOR_LEVELS.commandFloorElevationM;
  const tower: Rect = { x0: room.x0, x1: room.x0 + COMMAND_LAYOUT.towerDepthM, z0: room.z0, z1: room.z1 };
  const bridge: Rect = { x0: tower.x1, x1: tower.x1 + COMMAND_LAYOUT.bridgeDepthM, z0: room.z0, z1: room.z1 };
  const pit: Rect = { x0: bridge.x1, x1: room.x1, z0: room.z0, z1: room.z1 };
  return {
    room,
    floorY,
    bridgeY: floorY + COMMAND_LAYOUT.bridgeRiseM,
    towerY: floorY + COMMAND_LAYOUT.towerRiseM,
    tower,
    bridge,
    pit,
    lift: CAGE_PLAN.commandLift,
  };
}

export const COMMAND_PLAN = planCommand();
