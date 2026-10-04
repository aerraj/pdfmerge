/**
 * z7-cage placeholder: the dark Eva cage. Three bays open onto a coolant channel; the
 * arrival lift opens onto a dock, the boat waits in the channel, a walkway crosses to the
 * gantry in front of the bays, and the control window looks down from above the dock.
 */
import { CAGE_LAYOUT, Z7_LINGER } from '../../config/layout/cage';
import { CONSTRUCTION } from '../../config/layout/common';
import { CORRIDORS } from '../../config/layout/corridors';
import { CAGE, EVA } from '../../config/scale';
import type { Poi } from '../../contracts/manifest';
import { CAGE_PLAN, centreOf } from '../kit/anchors';
import { add, boxPart, merged, pitchTowards, poi, roomParts, slabPart, trigger, tuple, wallWithHoles, type Rect } from '../kit/nodes';
import { railPart, terminal } from '../kit/pieces';
import type { GeometryPart, NodeSpec, Vec3, ZoneSpec } from '../kit/spec';

const YAW_NORTH = 0;
const YAW_SOUTH = 180;
const YAW_WEST = 90;
const EVA_NAMES = ['00', '01', '02'] as const;
const GLASS_THICKNESS_M = 0.05;

export function buildZ7Cage(): ZoneSpec {
  const c = CAGE_PLAN;
  const t = CONSTRUCTION.wallThicknessM;
  const slab = CONSTRUCTION.slabThicknessM;
  const e = c.enclosure;
  const [lx, lz] = centreOf(c.arrivalLift);
  const liftH = CORRIDORS.liftHeightM;
  const deck = c.deckY;

  // Enclosure: floor, ceiling, north/east/west walls, and the south wall with holes for
  // both lifts and the control window.
  const shell: GeometryPart[] = [
    slabPart(e.x0 - t, e.x1 + t, e.z0 - t, e.z1 + t, c.bayFloorY, slab),
    slabPart(e.x0 - t, e.x1 + t, e.z0 - t, e.z1 + t, c.ceilingY + slab, slab),
    boxPart([(e.x0 + e.x1) / 2, (c.bayFloorY + c.ceilingY) / 2, e.z0 - t / 2], [e.x1 - e.x0 + 2 * t, c.ceilingY - c.bayFloorY, t]),
    boxPart([e.x0 - t / 2, (c.bayFloorY + c.ceilingY) / 2, (e.z0 + e.z1) / 2], [t, c.ceilingY - c.bayFloorY, e.z1 - e.z0]),
    boxPart([e.x1 + t / 2, (c.bayFloorY + c.ceilingY) / 2, (e.z0 + e.z1) / 2], [t, c.ceilingY - c.bayFloorY, e.z1 - e.z0]),
  ];
  const southWall = wallWithHoles('x', e.z1 + t / 2, e.x0 - t, e.x1 + t, c.bayFloorY, c.ceilingY, t, [
    { from: c.arrivalLift.x0, to: c.arrivalLift.x1, bottom: deck, top: deck + liftH },
    { from: c.commandLift.x0, to: c.commandLift.x1, bottom: deck, top: deck + liftH },
    { from: c.controlRoom.x0, to: c.controlRoom.x1, bottom: c.controlFloorY, top: c.controlFloorY + CAGE_LAYOUT.windowHeightM },
  ]);

  // Restraint walls between and beside the bays, full height.
  const bayWalls: GeometryPart[] = [];
  const bays = c.bays;
  const wallSpans: [number, number][] = [[e.x0, bays[0]?.x0 ?? e.x0]];
  for (let i = 0; i + 1 < bays.length; i++) wallSpans.push([bays[i]?.x1 ?? 0, bays[i + 1]?.x0 ?? 0]);
  wallSpans.push([bays[bays.length - 1]?.x1 ?? e.x1, e.x1]);
  const bayLength = (bays[0]?.z1 ?? 0) - e.z0;
  for (const [a, b] of wallSpans) {
    if (b - a <= 0) continue;
    bayWalls.push(boxPart([(a + b) / 2, (c.bayFloorY + c.ceilingY) / 2, e.z0 + bayLength / 2], [b - a, c.ceilingY - c.bayFloorY, bayLength]));
  }

  // Coolant over the channel and bays.
  const coolant = slabPart(e.x0, e.x1, e.z0, c.channel.z1, c.coolantY, slab);

  // Decks: dock, walkway, gantry; quay wall under the dock's front edge.
  const decks = [c.dock, c.walkway, c.gantry].map((r: Rect) => slabPart(r.x0, r.x1, r.z0, r.z1, deck, slab));
  const quay = boxPart([(c.dock.x0 + c.dock.x1) / 2, (deck + c.bayFloorY) / 2, c.dock.z0 + t / 2], [c.dock.x1 - c.dock.x0, deck - c.bayFloorY, t]);
  const ww = c.walkway;
  const rails: GeometryPart[] = [
    railPart([c.dock.x0, deck, c.dock.z0], [ww.x0, deck, c.dock.z0]),
    railPart([ww.x1, deck, c.dock.z0], [c.dock.x1, deck, c.dock.z0]),
    railPart([c.dock.x0, deck, c.dock.z0], [c.dock.x0, deck, c.dock.z1]),
    railPart([c.dock.x1, deck, c.dock.z0], [c.dock.x1, deck, c.dock.z1]),
    railPart([ww.x0, deck, ww.z0], [ww.x0, deck, ww.z1]),
    railPart([ww.x1, deck, ww.z0], [ww.x1, deck, ww.z1]),
    railPart([c.gantry.x0, deck, c.gantry.z1], [ww.x0, deck, c.gantry.z1]),
    railPart([ww.x1, deck, c.gantry.z1], [c.gantry.x1, deck, c.gantry.z1]),
    railPart([c.gantry.x0, deck, c.gantry.z0], [c.gantry.x1, deck, c.gantry.z0]),
    railPart([c.gantry.x0, deck, c.gantry.z0], [c.gantry.x0, deck, c.gantry.z1]),
    railPart([c.gantry.x1, deck, c.gantry.z0], [c.gantry.x1, deck, c.gantry.z1]),
  ];

  // Lifts and the control room behind the south wall.
  const liftRoom = (r: Rect) => roomParts({ rect: r, floorY: deck, height: liftH, open: ['north'] }, t, slab);
  const arrival = liftRoom(c.arrivalLift);
  const command = liftRoom(c.commandLift);
  const control = roomParts({ rect: c.controlRoom, floorY: c.controlFloorY, height: CAGE_LAYOUT.windowHeightM, open: ['north'] }, t, slab);
  const window = boxPart(
    [(c.controlRoom.x0 + c.controlRoom.x1) / 2, c.controlFloorY + CAGE_LAYOUT.windowHeightM / 2, e.z1],
    [c.controlRoom.x1 - c.controlRoom.x0, CAGE_LAYOUT.windowHeightM, GLASS_THICKNESS_M],
  );

  // The boat waits in the channel beside the dock.
  const boat = boxPart(
    [lx, c.coolantY + CAGE_LAYOUT.boatFreeboardM / 2, c.dock.z0 - CAGE_LAYOUT.boatWidthM],
    [CAGE_LAYOUT.boatLengthM, CAGE_LAYOUT.boatFreeboardM * 2, CAGE_LAYOUT.boatWidthM],
  );

  // Floodlights that slam on at the reveal.
  const floods: GeometryPart[] = [];
  const floodNodes: NodeSpec[] = [];
  for (let i = 0; i < CAGE_LAYOUT.floodlightCount; i++) {
    const x = e.x0 + ((i + 1 / 2) / CAGE_LAYOUT.floodlightCount) * (e.x1 - e.x0);
    const p: Vec3 = [x, c.ceilingY - CAGE_LAYOUT.floodlightSizeM / 2, (c.channel.z0 + c.channel.z1) / 2];
    floods.push(boxPart(p, [CAGE_LAYOUT.floodlightSizeM, CAGE_LAYOUT.floodlightSizeM, CAGE_LAYOUT.floodlightSizeM]));
    floodNodes.push({ name: `LGT_cage_flood_${String(i + 1).padStart(2, '0')}`, position: tuple(p) });
  }

  // Marks: the Evas stand in their bays facing south towards the dock.
  const evaMarks = bays.map((b, i): NodeSpec => {
    const [bx] = centreOf(b);
    return poi(`POI_mark_eva_${EVA_NAMES[i] ?? String(i)}`, [bx, c.bayFloorY, b.z1 - CAGE_LAYOUT.evaSetbackM], YAW_SOUTH);
  });
  const unit01 = bays[1] ?? c.bays[0];
  const [ux] = unit01 ? centreOf(unit01) : [lx];
  const face: Vec3 = [ux, c.bayFloorY + EVA.heightM * CAGE_LAYOUT.faceHeightRatio, (unit01?.z1 ?? 0) - CAGE_LAYOUT.evaSetbackM];
  const revealPoint: Vec3 = [ux, c.coolantY + CAGE_LAYOUT.boatFreeboardM, c.channel.z0 + CAGE_LAYOUT.revealStandOffM];
  const controlCentre: Vec3 = [(c.controlRoom.x0 + c.controlRoom.x1) / 2, c.controlFloorY, (c.controlRoom.z0 + c.controlRoom.z1) / 2];
  const lights: NodeSpec[] = [
    { name: 'LGT_cage_key', position: tuple(add(face, CAGE_LAYOUT.revealKeyOffsetM)) },
    { name: 'LGT_cage_rim', position: tuple(add(face, CAGE_LAYOUT.revealRimOffsetM)) },
    { name: 'LGT_cage_fill', position: tuple(add(face, CAGE_LAYOUT.revealFillOffsetM)) },
  ];

  const z7Terminal = terminal('z7-cage', [lx - CAGE_LAYOUT.commandLiftOffsetEastM / 2, deck, c.dock.z1 - CONSTRUCTION.terminalDepthM], YAW_SOUTH, Z7_LINGER.terminalSec);
  const gantryCentre: Vec3 = [ux, deck, (c.gantry.z0 + c.gantry.z1) / 2];
  const [cmx, cmz] = centreOf(c.commandLift);

  const nodes: NodeSpec[] = [
    merged('GEO_cage_shell', 'steel', [...shell, ...southWall, quay]),
    merged('GEO_bay_walls', 'interior', bayWalls),
    merged('GEO_coolant', 'coolant', [coolant]),
    merged('GEO_decks', 'floor', [...decks, ...arrival.floor, ...command.floor, ...control.floor]),
    merged('GEO_railings', 'steel', rails),
    merged('GEO_lift_cars', 'steel', [...arrival.walls, ...arrival.ceiling, ...command.walls, ...command.ceiling]),
    merged('GEO_control_room', 'interior', [...control.walls, ...control.ceiling]),
    merged('GEO_control_window', 'glass', [window]),
    merged('GEO_boat', 'steel', [boat]),
    merged('GEO_floodlights', 'steel', floods),
    ...floodNodes,
    ...lights,
    ...z7Terminal.nodes,
    merged('COL_cage', 'concrete', [...decks, ...rails, ...arrival.floor, ...arrival.walls, ...command.floor, ...command.walls]),
    ...evaMarks,
    poi('POI_dock_edge', [lx, deck, c.dock.z0 + CONSTRUCTION.terminalStandOffM * 2], YAW_NORTH),
    poi('POI_reveal_face', revealPoint, YAW_NORTH, pitchTowards(revealPoint, face)),
    poi('POI_gantry_01', gantryCentre, YAW_NORTH),
    poi('POI_mark_gendo', controlCentre, YAW_NORTH),
    poi('POI_mark_rei', [(c.gantry.x1 + ux) / 2, deck, (c.gantry.z0 + c.gantry.z1) / 2], YAW_WEST),
    poi('POI_mark_misato', [lx - CAGE_LAYOUT.markSpacingM / 2, deck, c.dock.z0 + CONSTRUCTION.terminalStandOffM * 3], YAW_NORTH),
    poi('POI_mark_ritsuko', [lx + CAGE_LAYOUT.markSpacingM / 2, deck, c.dock.z0 + CONSTRUCTION.terminalStandOffM * 3], YAW_NORTH),
    trigger('TRG_lift_command', [cmx, deck + liftH / 2, cmz], [CORRIDORS.liftSizeM / 2 - t, liftH / 2, CORRIDORS.liftSizeM / 2 - t]),
  ];
  const pois: Poi[] = [
    { id: 'poi-dock-edge', node: 'POI_dock_edge', lingerSec: Z7_LINGER.dockSec },
    { id: 'poi-reveal-face', node: 'POI_reveal_face', lingerSec: Z7_LINGER.revealSec },
    { id: 'poi-gantry-01', node: 'POI_gantry_01', lingerSec: Z7_LINGER.gantrySec },
    z7Terminal.poi,
  ];
  return {
    id: 'z7-cage',
    nodes,
    manifest: {
      id: 'z7-cage',
      glb: 'z7-cage.glb',
      next: 'z6-command',
      prev: 'z5-corridors',
      spawn: { position: tuple([lx, deck, lz]), yawDeg: YAW_NORTH },
      guidedPath: null,
      transition: { type: 'lift', triggerNode: 'TRG_lift_command' },
      ambience: [],
      reverb: null,
      pois,
      alsoVisible: [],
    },
    vehiclePois: ['POI_reveal_face'],
    scaleChecks: [{ node: 'GEO_bay_walls', axis: 'y', expectedM: CAGE.depthM + CAGE_LAYOUT.ceilingAboveCoolantM, tolerance: 0.01 }],
  };
}
