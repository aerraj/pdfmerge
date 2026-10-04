/**
 * z6-command placeholder: the command centre. The main tactical screen fills the east
 * wall; the commander's tower, the operators' bridge and the floor step down towards it.
 * The lift from the cage arrives at the back of the tower.
 */
import { CONSTRUCTION } from '../../config/layout/common';
import { COMMAND_LAYOUT, Z6_LINGER } from '../../config/layout/command';
import { CORRIDORS } from '../../config/layout/corridors';
import { COMMAND } from '../../config/scale';
import type { Poi } from '../../contracts/manifest';
import { centreOf, COMMAND_PLAN } from '../kit/anchors';
import { boxPart, merged, poi, roomParts, slabBetween, tuple } from '../kit/nodes';
import { lightStrips, railPart, terminal } from '../kit/pieces';
import type { GeometryPart, NodeSpec, Vec3, ZoneSpec } from '../kit/spec';

const YAW_EAST = -90;
const YAW_NORTH = 0;
const OPERATORS = ['maya', 'makoto', 'shigeru'] as const;
const SCREEN_DEPTH_M = 0.1;
const CONSOLE_SCREEN_DEPTH_M = 0.02;
/** Marks stand this far behind an edge or a console, m. */
const STAND_BACK_M = 2;

/** Stairs from an upper tier edge down (eastwards) to a lower tier: visual steps and a walkable ramp. */
function stairs(x: number, upperY: number, lowerY: number, z: number): { steps: GeometryPart[]; ramp: GeometryPart; endX: number } {
  const count = Math.round((upperY - lowerY) / COMMAND_LAYOUT.stairRiseM);
  const rise = (upperY - lowerY) / count;
  const tread = COMMAND_LAYOUT.stairTreadM;
  const steps: GeometryPart[] = [];
  for (let i = 0; i < count; i++) {
    const top = upperY - (i + 1) * rise;
    // Each step is a block from the lower tier up to its tread.
    steps.push(boxPart([x + (i + 1 / 2) * tread, (top + lowerY) / 2, z], [tread, Math.max(top - lowerY, rise), COMMAND_LAYOUT.stairWidthM]));
  }
  const endX = x + count * tread;
  return { steps, ramp: slabBetween([x, upperY, z], [endX, lowerY, z], COMMAND_LAYOUT.stairWidthM, CONSTRUCTION.slabThicknessM), endX };
}

export function buildZ6Command(): ZoneSpec {
  const p = COMMAND_PLAN;
  const r = p.room;
  const t = CONSTRUCTION.wallThicknessM;
  const slab = CONSTRUCTION.slabThicknessM;
  const shell = roomParts({ rect: r, floorY: p.floorY, height: COMMAND.heightM }, t, slab);
  const sz = COMMAND_LAYOUT.stairCentreZM;
  const half = COMMAND_LAYOUT.stairWidthM / 2;

  // Tiers are solid blocks rising from the room floor.
  const tower = boxPart([(p.tower.x0 + p.tower.x1) / 2, (p.floorY + p.towerY) / 2, (r.z0 + r.z1) / 2], [p.tower.x1 - p.tower.x0, p.towerY - p.floorY, r.z1 - r.z0]);
  const bridge = boxPart([(p.bridge.x0 + p.bridge.x1) / 2, (p.floorY + p.bridgeY) / 2, (r.z0 + r.z1) / 2], [p.bridge.x1 - p.bridge.x0, p.bridgeY - p.floorY, r.z1 - r.z0]);
  const upper = stairs(p.tower.x1, p.towerY, p.bridgeY, sz);
  const lower = stairs(p.bridge.x1, p.bridgeY, p.floorY, sz);
  const rails: GeometryPart[] = [
    railPart([p.tower.x1, p.towerY, r.z0], [p.tower.x1, p.towerY, sz - half]),
    railPart([p.tower.x1, p.towerY, sz + half], [p.tower.x1, p.towerY, r.z1]),
    railPart([p.bridge.x1, p.bridgeY, r.z0], [p.bridge.x1, p.bridgeY, sz - half]),
    railPart([p.bridge.x1, p.bridgeY, sz + half], [p.bridge.x1, p.bridgeY, r.z1]),
  ];

  // Main screen on the east wall (front faces west, towards the room).
  const [, rz] = centreOf(r);
  const screenCentre: Vec3 = [r.x1 - SCREEN_DEPTH_M, p.floorY + COMMAND_LAYOUT.screenBottomM + COMMAND.mainScreenHeightM / 2, rz];

  // Operator consoles along the bridge's front edge, the commander's desk on the tower.
  const consoles = COMMAND_LAYOUT.consoleZM.map((z) =>
    boxPart([p.bridge.x1 - COMMAND_LAYOUT.consoleDepthM, p.bridgeY + COMMAND_LAYOUT.consoleHeightM / 2, z], [COMMAND_LAYOUT.consoleDepthM, COMMAND_LAYOUT.consoleHeightM, COMMAND_LAYOUT.consoleWidthM]),
  );
  const consoleScreens: NodeSpec[] = COMMAND_LAYOUT.consoleZM.map((z, i) => ({
    name: `SCR_console_${OPERATORS[i] ?? String(i)}`,
    position: tuple([p.bridge.x1 - COMMAND_LAYOUT.consoleDepthM, p.bridgeY + COMMAND_LAYOUT.consoleHeightM + COMMAND_LAYOUT.consoleScreenHeightM / 2, z]),
    rotationDeg: [0, YAW_EAST, 0],
    mesh: { geometry: { kind: 'box', size: [COMMAND_LAYOUT.consoleScreenWidthM, COMMAND_LAYOUT.consoleScreenHeightM, CONSOLE_SCREEN_DEPTH_M] }, material: 'screen' },
  }));
  const desk = boxPart(
    [p.tower.x1 - COMMAND_LAYOUT.deskDepthM, p.towerY + COMMAND_LAYOUT.deskHeightM / 2, rz],
    [COMMAND_LAYOUT.deskDepthM, COMMAND_LAYOUT.deskHeightM, COMMAND_LAYOUT.deskWidthM],
  );

  const lift = roomParts({ rect: p.lift, floorY: p.towerY, height: CORRIDORS.liftHeightM, open: ['east'] }, t, slab);
  const [lx, lz] = centreOf(p.lift);
  const z6Terminal = terminal('z6-command', [(p.tower.x0 + p.tower.x1) / 2, p.towerY, r.z0 + CONSTRUCTION.terminalDepthM], YAW_NORTH, Z6_LINGER.terminalSec);

  const nodes: NodeSpec[] = [
    merged('GEO_command_shell', 'interior', [...shell.walls, ...shell.ceiling]),
    merged('GEO_command_floor', 'floor', [...shell.floor, tower, bridge]),
    merged('GEO_command_stairs', 'floor', [...upper.steps, ...lower.steps]),
    merged('GEO_command_rails', 'steel', rails),
    merged('GEO_consoles', 'steel', [...consoles, desk]),
    merged('GEO_command_lights', 'lightStrip', lightStrips([r.x0, 0, rz], [r.x1, 0, rz], p.floorY + COMMAND.heightM)),
    merged('GEO_lift_car', 'steel', [...lift.walls, ...lift.ceiling]),
    {
      name: 'SCR_command_main',
      position: tuple(screenCentre),
      rotationDeg: [0, YAW_EAST, 0],
      mesh: { geometry: { kind: 'box', size: [COMMAND.mainScreenWidthM, COMMAND.mainScreenHeightM, SCREEN_DEPTH_M] }, material: 'screen' },
    },
    ...consoleScreens,
    ...z6Terminal.nodes,
    merged('COL_command', 'concrete', [...shell.floor, ...shell.walls, tower, bridge, upper.ramp, lower.ramp, ...rails, ...consoles, desk, ...lift.floor, ...lift.walls]),
    poi('POI_stairs_top', [p.tower.x1 - STAND_BACK_M / 2, p.towerY, sz], YAW_EAST),
    poi('POI_launch_view', [p.bridge.x1 - STAND_BACK_M * 2, p.bridgeY, (sz + rz) / 2], YAW_EAST),
    poi('POI_mark_gendo', [p.tower.x1 - COMMAND_LAYOUT.deskDepthM - STAND_BACK_M, p.towerY, rz], YAW_EAST),
    poi('POI_mark_fuyutsuki', [p.tower.x1 - COMMAND_LAYOUT.deskDepthM - STAND_BACK_M, p.towerY, rz + COMMAND_LAYOUT.deskWidthM / 2 + STAND_BACK_M], YAW_EAST),
    ...COMMAND_LAYOUT.consoleZM.map((z, i) =>
      poi(`POI_mark_op_${OPERATORS[i] ?? String(i)}`, [p.bridge.x1 - COMMAND_LAYOUT.consoleDepthM - STAND_BACK_M, p.bridgeY, z], YAW_EAST),
    ),
    poi('POI_mark_misato', [p.bridge.x0 + STAND_BACK_M * 3, p.bridgeY, rz - STAND_BACK_M], YAW_EAST),
    poi('POI_mark_ritsuko', [p.bridge.x0 + STAND_BACK_M * 3, p.bridgeY, rz + STAND_BACK_M], YAW_EAST),
    poi('POI_lift_arrival', [lx, p.towerY, lz], YAW_EAST),
  ];
  // Stair landings and the floor in front of the screen.
  nodes.push(
    poi('POI_stairs_bottom', [upper.endX + STAND_BACK_M / 2, p.bridgeY, sz], YAW_EAST),
    poi('POI_lower_stairs_top', [p.bridge.x1 - STAND_BACK_M / 2, p.bridgeY, sz], YAW_EAST),
    poi('POI_screen_floor', [lower.endX + STAND_BACK_M, p.floorY, sz], YAW_EAST),
  );
  const pois: Poi[] = [
    { id: 'poi-lift-arrival', node: 'POI_lift_arrival', lingerSec: Z6_LINGER.arrivalSec },
    { id: 'poi-stairs-top', node: 'POI_stairs_top', lingerSec: Z6_LINGER.stairsSec },
    { id: 'poi-launch-view', node: 'POI_launch_view', lingerSec: Z6_LINGER.launchViewSec },
    z6Terminal.poi,
  ];
  return {
    id: 'z6-command',
    nodes,
    manifest: {
      id: 'z6-command',
      glb: 'z6-command.glb',
      next: null,
      prev: 'z7-cage',
      spawn: { position: tuple([lx, p.towerY, lz]), yawDeg: YAW_EAST },
      guidedPath: null,
      transition: null,
      ambience: [],
      reverb: null,
      pois,
      alsoVisible: [],
    },
    scaleChecks: [{ node: 'SCR_command_main', axis: 'z', expectedM: COMMAND.mainScreenWidthM, tolerance: 0.01 }],
  };
}
