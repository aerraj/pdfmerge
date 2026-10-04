import { MathUtils } from 'three';
import { CONSTRUCTION } from '../../config/layout/common';
import type { Poi, ZoneId } from '../../contracts/manifest';
import { add, boxPart, mm3, poi } from './nodes';
import type { GeometryPart, NodeSpec, Vec3 } from './spec';

const SCREEN_THICKNESS_M = 0.02;
const BEZEL_M = 0.05;

/** Unit vector a viewer facing `yawDeg` looks along. */
export function forward(yawDeg: number): Vec3 {
  const r = MathUtils.degToRad(yawDeg);
  return [-Math.sin(r), 0, -Math.cos(r)];
}

/**
 * A wall terminal: SCR_ screen (front faces the viewer, local +Z), a console body behind it,
 * and the POI where Shinji stands to use it. `floorPoint` is the floor under the screen;
 * `viewerYawDeg` is the direction the viewer faces when using it.
 */
export function terminal(zone: ZoneId, floorPoint: Vec3, viewerYawDeg: number, lingerSec: number): { nodes: NodeSpec[]; poi: Poi } {
  const zoneNumber = zone.slice(1, zone.indexOf('-'));
  const f = forward(viewerYawDeg);
  const centre = add(floorPoint, [0, CONSTRUCTION.terminalCentreHeightM, 0]);
  const screenName = `SCR_terminal_z${zoneNumber}`;
  const poiName = `POI_terminal_z${zoneNumber}`;
  const bodyOffset = CONSTRUCTION.terminalDepthM / 2 + SCREEN_THICKNESS_M;
  const stand = add(floorPoint, [-f[0] * CONSTRUCTION.terminalStandOffM, 0, -f[2] * CONSTRUCTION.terminalStandOffM]);
  const nodes: NodeSpec[] = [
    {
      name: screenName,
      position: mm3(centre),
      rotationDeg: [0, viewerYawDeg, 0],
      mesh: { geometry: { kind: 'box', size: [CONSTRUCTION.terminalWidthM, CONSTRUCTION.terminalHeightM, SCREEN_THICKNESS_M] }, material: 'screen' },
    },
    {
      name: `GEO_terminal_z${zoneNumber}_body`,
      position: mm3(add(centre, [f[0] * bodyOffset, 0, f[2] * bodyOffset])),
      rotationDeg: [0, viewerYawDeg, 0],
      mesh: {
        geometry: {
          kind: 'box',
          size: [CONSTRUCTION.terminalWidthM + 2 * BEZEL_M, CONSTRUCTION.terminalHeightM + 2 * BEZEL_M, CONSTRUCTION.terminalDepthM],
        },
        material: 'steel',
      },
    },
    poi(poiName, stand, viewerYawDeg),
  ];
  return {
    nodes,
    poi: { id: `poi-terminal-z${zoneNumber}`, node: poiName, lingerSec, event: { type: 'terminal', screen: screenName } },
  };
}

/** Ceiling light strips along a straight run, as parts for one merged emissive mesh. */
export function lightStrips(from: Vec3, to: Vec3, ceilingY: number): GeometryPart[] {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const length = Math.hypot(dx, dz);
  const count = Math.max(1, Math.floor(length / CONSTRUCTION.lightStripSpacingM));
  const alongX = Math.abs(dx) >= Math.abs(dz);
  const size: Vec3 = alongX
    ? [CONSTRUCTION.lightStripLengthM, CONSTRUCTION.lightStripWidthM / 2, CONSTRUCTION.lightStripWidthM]
    : [CONSTRUCTION.lightStripWidthM, CONSTRUCTION.lightStripWidthM / 2, CONSTRUCTION.lightStripLengthM];
  return Array.from({ length: count }, (_, i) => {
    const t = (i + 0.5) / count;
    return boxPart([from[0] + dx * t, ceilingY - CONSTRUCTION.lightStripWidthM / 4, from[2] + dz * t], size);
  });
}

/** Guard rail along a straight edge at a deck height, as a collision and visual part. */
export function railPart(from: Vec3, to: Vec3): GeometryPart {
  const dx = to[0] - from[0];
  const dz = to[2] - from[2];
  const alongX = Math.abs(dx) >= Math.abs(dz);
  const length = Math.hypot(dx, dz);
  const h = CONSTRUCTION.railingHeightM;
  const t = CONSTRUCTION.railingThicknessM;
  return boxPart(
    [(from[0] + to[0]) / 2, from[1] + h / 2, (from[2] + to[2]) / 2],
    alongX ? [length, h, t] : [t, h, length],
  );
}
