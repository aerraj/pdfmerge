import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { AMBIENCE, MUSIC } from '../../src/config/audio';
import { FRAME_BUDGET, RENDER_BUDGET } from '../../src/config/budgets';
import { HEAD_BOB, LOOK, PHYSICS, WALK } from '../../src/config/movement';
import { CAMERA, IMAGE } from '../../src/config/render';
import { CAGE, CAR, CAVERN, CORRIDOR, CRUST, EVA, PYRAMID, SHINJI } from '../../src/config/scale';
import { CARTRAIN_LINE, INTERIOR_LEVELS, STREET_ELEVATION_M, ZONE_ROUTE } from '../../src/config/world';

const CONFIG_DIR = resolve(import.meta.dirname, '../../src/config');

describe('scale constants', () => {
  it("puts the camera at Shinji's 1.50 m eye height (DECISIONS D-011)", () => {
    expect(SHINJI.eyeHeightM).toBe(1.5);
  });

  it('keeps the body consistent with the eye height', () => {
    expect(SHINJI.eyeHeightM).toBeLessThan(SHINJI.statureM);
    expect(SHINJI.statureM - SHINJI.eyeHeightM).toBeGreaterThan(0.08);
    expect(SHINJI.statureM).toBeGreaterThan(2 * SHINJI.bodyRadiusM);
    expect(CORRIDOR.doorHeightM).toBeGreaterThan(SHINJI.statureM);
  });

  it('fits the pyramid and the cartrain mouth inside the cavern', () => {
    expect(CAVERN.heightM).toBeLessThan(1000);
    expect(PYRAMID.heightM).toBeLessThan(CAVERN.heightM);
    expect(PYRAMID.baseM).toBeLessThan(CAVERN.diameterM / 2);
    expect(CARTRAIN_LINE.tunnelMouthElevationM).toBeLessThan(CAVERN.heightM);
    expect(STREET_ELEVATION_M).toBe(CAVERN.heightM + CRUST.thicknessM);
  });

  it('makes Unit-01 stand chest-deep in coolant with its head above the surface', () => {
    const headAboveCoolant = EVA.heightM - CAGE.depthM;
    expect(headAboveCoolant).toBeGreaterThan(4);
    expect(headAboveCoolant).toBeLessThan(EVA.heightM / 3);
    expect(CAGE.controlWindowSillM).toBeGreaterThan(headAboveCoolant);
    expect(INTERIOR_LEVELS.cageCoolantElevationM - CAGE.depthM).toBeLessThan(INTERIOR_LEVELS.lowerCorridorElevationM);
  });

  it('seats Shinji below his standing eye height inside the car', () => {
    expect(CAR.seatHeightM + SHINJI.seatedEyeAboveSeatM).toBeLessThan(SHINJI.eyeHeightM);
    expect(CAR.seatHeightM + SHINJI.seatedEyeAboveSeatM).toBeLessThan(CAR.heightM);
  });
});

describe('route', () => {
  it('runs the seven scenes in story order, cage before command centre', () => {
    expect(ZONE_ROUTE).toEqual([
      'z1-surface',
      'z2-descent',
      'z3-cavern',
      'z4-pyramid',
      'z5-corridors',
      'z7-cage',
      'z6-command',
    ]);
  });
});

describe('budgets and feel', () => {
  it('matches the design-doc performance table', () => {
    expect(FRAME_BUDGET.desktop.p99Ms).toBe(18);
    expect(FRAME_BUDGET.mobile.p99Ms).toBe(36);
    expect(FRAME_BUDGET.hitchMs).toBe(50);
    expect(RENDER_BUDGET.mobile.drawCalls).toBeLessThan(RENDER_BUDGET.desktop.drawCalls);
    expect(RENDER_BUDGET.mobile.triangles).toBeLessThan(RENDER_BUDGET.desktop.triangles);
  });

  it('ducks music 8 to 10 dB under dialogue', () => {
    expect(-MUSIC.duckDb).toBeGreaterThanOrEqual(8);
    expect(-MUSIC.duckDb).toBeLessThanOrEqual(10);
    expect(AMBIENCE.zoneCrossfadeSec).toBeGreaterThan(0);
  });

  it('keeps camera and controller values physically sensible', () => {
    expect(CAMERA.nearM).toBeLessThanOrEqual(0.1);
    expect(CAMERA.farM).toBeGreaterThanOrEqual(10_000);
    expect(IMAGE.maxDevicePixelRatio).toBe(2);
    expect(IMAGE.minDynamicScale).toBe(0.6);
    expect(WALK.maxStepM).toBeLessThan(SHINJI.statureM / 4);
    expect(PHYSICS.fixedStepSec).toBeCloseTo(1 / 60);
    expect(LOOK.scriptedConeDeg).toBe(60);
    expect(HEAD_BOB.verticalAmplitudeM).toBeLessThan(0.05);
  });
});

// ---- Convention: every constant has a unit and a source comment ---------------------

const SOURCE_TAG = /\[(doc|fan|real|anthro|est|tuned)\]/;
/** Unit right after the description: "Description, <unit>." */
const UNIT_IN_COMMENT = /,\s*(m|m\/s|m\/s²|s|ms|deg|Hz|dB|fps|MB|Mbps|px|ratio|count|frames|sRGB hex|path)\b/;

interface ConstantDoc {
  file: string;
  name: string;
  comment: string;
}

function jsDocOf(node: ts.Node, source: ts.SourceFile): string {
  const ranges = ts.getLeadingCommentRanges(source.text, node.getFullStart()) ?? [];
  return ranges.map((r) => source.text.slice(r.pos, r.end)).join('\n');
}

function isLiteralValue(node: ts.Expression): boolean {
  if (ts.isNumericLiteral(node) || ts.isStringLiteral(node)) return true;
  if (ts.isPrefixUnaryExpression(node)) return isLiteralValue(node.operand);
  if (ts.isBinaryExpression(node)) return isLiteralValue(node.left) && isLiteralValue(node.right);
  return false;
}

function collectConstants(file: string): ConstantDoc[] {
  const source = ts.createSourceFile(file, readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
  const found: ConstantDoc[] = [];
  const visit = (node: ts.Node) => {
    if (ts.isPropertyAssignment(node) && isLiteralValue(node.initializer)) {
      found.push({ file, name: node.name.getText(source), comment: jsDocOf(node, source) });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

describe('config documentation convention', () => {
  const files = readdirSync(CONFIG_DIR)
    .filter((f) => f.endsWith('.ts'))
    .map((f) => join(CONFIG_DIR, f));
  const constants = files.flatMap(collectConstants);

  it('finds the config constants', () => {
    expect(constants.length).toBeGreaterThan(50);
  });

  it.each(constants.map((c) => [`${c.file.split('/').pop() ?? ''}: ${c.name}`, c] as const))(
    '%s has a unit and a source tag',
    (_label, c) => {
      expect(c.comment, 'missing doc comment').not.toBe('');
      expect(c.comment, 'missing source tag such as [doc] or [est]').toMatch(SOURCE_TAG);
      expect(c.comment, 'missing unit (", m." / ", s." / ", ratio." ...)').toMatch(UNIT_IN_COMMENT);
    },
  );
});
