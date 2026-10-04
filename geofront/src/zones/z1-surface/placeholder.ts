/**
 * z1-surface placeholder: the evacuated Tokyo-3 street where Shinji waits, the phone
 * booth, utility poles and wires, and the cartrain station whose hall leads to the shaft.
 */
import { CONSTRUCTION } from '../../config/layout/common';
import { KIOSK, PHONE_BOOTH, STATION, STREET, STREET_SUN, Z1_LINGER } from '../../config/layout/street';
import { STREET_ELEVATION_M } from '../../config/world';
import type { Poi } from '../../contracts/manifest';
import { SHAFT_HEAD, STATION_PORTAL } from '../kit/anchors';
import { boxPart, merged, meshNode, mm3, poi, roomParts, slabPart, trigger, tuple } from '../kit/nodes';
import { lightStrips, terminal } from '../kit/pieces';
import { between, createRng } from '../kit/rng';
import type { GeometryPart, NodeSpec, ZoneSpec } from '../kit/spec';

const YAW_EAST = -90;
const YAW_SOUTH = 180;
const YAW_NORTH = 0;

export function buildZ1Surface(): ZoneSpec {
  const E = STREET_ELEVATION_M;
  const px = STATION_PORTAL[0];
  const westEnd = px - STREET.lengthM;
  const roadHalf = STREET.roadWidthM / 2;
  const kerbTop = E + STREET.kerbHeightM;
  const pavementOuter = roadHalf + STREET.pavementWidthM;
  const blockOuter = pavementOuter + STREET.blockDepthM;
  const t = CONSTRUCTION.wallThicknessM;
  const slab = CONSTRUCTION.slabThicknessM;

  // Street surfaces.
  const road = slabPart(westEnd, px, -roadHalf, roadHalf, E, slab);
  const pavements = [slabPart(westEnd, px, -pavementOuter, -roadHalf, kerbTop, slab), slabPart(westEnd, px, roadHalf, pavementOuter, kerbTop, slab)];

  // Building rows on both sides, ending at the station facade.
  const rng = createRng(STREET.seed);
  const buildings: GeometryPart[] = [];
  for (const side of [-1, 1]) {
    let x = westEnd;
    while (x < px - STREET.blockGapM) {
      const frontage = Math.min(between(rng, STREET.blockFrontageMinM, STREET.blockFrontageMaxM), px - x);
      const height = between(rng, STREET.blockHeightMinM, STREET.blockHeightMaxM);
      const zMid = side * (pavementOuter + blockOuter) / 2;
      buildings.push(boxPart([x + frontage / 2, kerbTop + height / 2, zMid], [frontage, height, STREET.blockDepthM]));
      x += frontage + STREET.blockGapM;
    }
  }
  // Backdrop behind each row so gaps between buildings never show the void.
  for (const side of [-1, 1]) {
    buildings.push(boxPart([(westEnd + px) / 2, kerbTop + STREET.blockHeightMinM / 2, side * (blockOuter + t / 2)], [px - westEnd, STREET.blockHeightMinM, t]));
  }
  // Close the west end of the street (walkable boundary; reads as more street in the haze).
  const westStop = boxPart([westEnd - t / 2, E + STREET.blockHeightMinM / 2, 0], [t, STREET.blockHeightMinM, 2 * blockOuter]);

  // Station: facade with the vehicle portal, the hall inside, and an outer block behind the facade.
  const hall = { x0: px, x1: SHAFT_HEAD[0], z0: -STATION.hallWidthM / 2, z1: STATION.hallWidthM / 2 };
  const hallRoom = roomParts(
    { rect: hall, floorY: E, height: STATION.hallHeightM, open: ['east'], openings: [{ side: 'west', from: -STATION.portalWidthM / 2, to: STATION.portalWidthM / 2 }] },
    t,
    slab,
  );
  // The hall's west wall is replaced by the full-width facade below.
  const hallWalls = hallRoom.walls.filter((w) => Math.abs(w.position[0] - (px - t / 2)) > t);
  const facadeY = E + STATION.facadeHeightM / 2;
  const portalHalf = STATION.portalWidthM / 2;
  const facadeSide = blockOuter - portalHalf;
  const facade: GeometryPart[] = [
    boxPart([px - t / 2, facadeY, -(portalHalf + facadeSide / 2)], [t, STATION.facadeHeightM, facadeSide]),
    boxPart([px - t / 2, facadeY, portalHalf + facadeSide / 2], [t, STATION.facadeHeightM, facadeSide]),
    boxPart(
      [px - t / 2, E + STATION.portalHeightM + (STATION.facadeHeightM - STATION.portalHeightM) / 2, 0],
      [t, STATION.facadeHeightM - STATION.portalHeightM, STATION.portalWidthM],
    ),
  ];
  const stationLength = hall.x1 - hall.x0;
  const outerBlock: GeometryPart[] = [
    boxPart([px + stationLength / 2, E + STATION.facadeHeightM, 0], [stationLength, slab, 2 * blockOuter]),
    boxPart([px + stationLength / 2, facadeY, -blockOuter], [stationLength, STATION.facadeHeightM, t]),
    boxPart([px + stationLength / 2, facadeY, blockOuter], [stationLength, STATION.facadeHeightM, t]),
  ];
  // Wall above the shaft opening at the east end of the hall, up to the roof.
  const eastAbove = STATION.facadeHeightM - STATION.hallHeightM;
  const eastHeader = boxPart([hall.x1 + t / 2, E + STATION.hallHeightM + eastAbove / 2, 0], [t, eastAbove, 2 * blockOuter]);

  // Utility poles and wires along both pavements.
  const poles: GeometryPart[] = [];
  const wires: GeometryPart[] = [];
  const poleZ = pavementOuter - STREET.pavementWidthM / 4;
  const wireY = kerbTop + STREET.poleHeightM - 1;
  for (const side of [-1, 1]) {
    let previous: number | null = null;
    for (let x = westEnd + STREET.poleSpacingM / 2; x < px; x += STREET.poleSpacingM) {
      poles.push({
        geometry: { kind: 'cylinder', radiusTop: STREET.poleRadiusM * STREET.poleTaperRatio, radiusBottom: STREET.poleRadiusM, height: STREET.poleHeightM, segments: 8 },
        position: [x, kerbTop + STREET.poleHeightM / 2, side * poleZ],
      });
      if (previous !== null) {
        wires.push(boxPart([(x + previous) / 2, wireY, side * poleZ], [x - previous, STREET.wireThicknessM, STREET.wireThicknessM]));
      }
      previous = x;
    }
  }

  // Shinji's waiting spot, the phone booth and the information kiosk.
  const waitX = px - STREET.waitDistanceM;
  const pavementMidZ = -(roadHalf + STREET.pavementWidthM / 2);
  const spawn = mm3([waitX, kerbTop, pavementMidZ]);
  const boothX = waitX - PHONE_BOOTH.offsetWestM;
  const booth: NodeSpec = merged('GEO_phone_booth', 'glass', [
    boxPart([boothX, kerbTop + PHONE_BOOTH.heightM / 2, pavementMidZ], [PHONE_BOOTH.sizeM, PHONE_BOOTH.heightM, PHONE_BOOTH.sizeM]),
  ]);
  const kioskX = waitX + KIOSK.offsetEastM;
  const kioskFloor = mm3([kioskX, kerbTop, pavementMidZ - CONSTRUCTION.terminalStandOffM / 2]);
  const z1Terminal = terminal('z1-surface', kioskFloor, YAW_NORTH, Z1_LINGER.terminalSec);

  const portalPoint = mm3([px + 1, E, 0]);
  const boardingPoint = mm3([px + STATION.boardingDistanceM, E, 0]);
  const collision: GeometryPart[] = [
    road,
    ...pavements,
    ...buildings,
    westStop,
    ...facade,
    ...hallRoom.floor,
    ...hallWalls,
    boxPart([boothX, kerbTop + PHONE_BOOTH.heightM / 2, pavementMidZ], [PHONE_BOOTH.sizeM, PHONE_BOOTH.heightM, PHONE_BOOTH.sizeM]),
  ];

  const nodes: NodeSpec[] = [
    merged('GEO_road', 'asphalt', [road]),
    merged('GEO_pavements', 'concrete', pavements),
    merged('GEO_buildings', 'facade', [...buildings, westStop]),
    merged('GEO_station', 'concrete', [...facade, ...outerBlock, eastHeader, ...hallWalls, ...hallRoom.ceiling]),
    merged('GEO_station_floor', 'floor', hallRoom.floor),
    merged('GEO_station_lights', 'lightStrip', lightStrips([hall.x0, 0, 0], [hall.x1, 0, 0], E + STATION.hallHeightM)),
    merged('GEO_utility_poles', 'concrete', poles),
    merged('GEO_wires', 'steel', wires),
    booth,
    meshNode(
      'GEO_kiosk_post',
      'steel',
      { kind: 'cylinder', radiusTop: KIOSK.postRadiusM, radiusBottom: KIOSK.postRadiusM, height: CONSTRUCTION.terminalCentreHeightM, segments: 8 },
      [kioskX, kerbTop + CONSTRUCTION.terminalCentreHeightM / 2, pavementMidZ - CONSTRUCTION.terminalStandOffM / 2 + CONSTRUCTION.terminalDepthM],
    ),
    ...z1Terminal.nodes,
    merged('COL_street', 'concrete', collision),
    poi('POI_phone_booth', [boothX, kerbTop, pavementMidZ + PHONE_BOOTH.sizeM], YAW_NORTH),
    poi('POI_misato_arrival', [waitX, E, -roadHalf / 2], YAW_EAST),
    poi('POI_station_portal', portalPoint, YAW_EAST),
    poi('POI_cartrain_boarding', boardingPoint, YAW_EAST),
    { name: 'LGT_sun_key', position: mm3([px - STREET_SUN.westM, E + STREET_SUN.upM, -STREET_SUN.northM]) },
    trigger(
      'TRG_shaft_head',
      [hall.x1 - CONSTRUCTION.triggerHalfDepthM, E + STATION.portalHeightM / 2, 0],
      [CONSTRUCTION.triggerHalfDepthM, STATION.portalHeightM / 2, STATION.hallWidthM / 2],
    ),
  ];

  const pois: Poi[] = [
    { id: 'poi-phone-booth', node: 'POI_phone_booth', lingerSec: Z1_LINGER.phoneBoothSec },
    { id: 'poi-misato-arrival', node: 'POI_misato_arrival', lingerSec: Z1_LINGER.misatoArrivalSec },
    { id: 'poi-station-portal', node: 'POI_station_portal', lingerSec: Z1_LINGER.stationSec },
    { id: 'poi-cartrain-boarding', node: 'POI_cartrain_boarding', lingerSec: Z1_LINGER.boardingSec },
    z1Terminal.poi,
  ];

  return {
    id: 'z1-surface',
    nodes,
    manifest: {
      id: 'z1-surface',
      glb: 'z1-surface.glb',
      next: 'z2-descent',
      prev: null,
      spawn: { position: tuple(spawn), yawDeg: YAW_SOUTH },
      guidedPath: null,
      transition: { type: 'vehicle', triggerNode: 'TRG_shaft_head' },
      ambience: [],
      reverb: null,
      pois,
      alsoVisible: ['z2-descent'],
    },
    scaleChecks: [{ node: 'GEO_road', axis: 'z', expectedM: STREET.roadWidthM, tolerance: 0.01 }],
  };
}
