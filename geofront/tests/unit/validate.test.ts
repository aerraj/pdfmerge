import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { validatePublic, visemeFileFor, type Issue } from '../../scripts/lib/validate';
import { ZONE_ROUTE } from '../../src/config/world';
import { nodeNameProblem } from '../../src/contracts/nodeNames';
import { buildGlb, type FixtureNode } from '../support/glbFixture';

type Json = Record<string, unknown>;
type ZoneId = (typeof ZONE_ROUTE)[number];

const FIXTURES = resolve(import.meta.dirname, '../fixtures');
const sampleManifest = () => JSON.parse(readFileSync(join(FIXTURES, 'manifest.sample.json'), 'utf8')) as Json;
const sampleScene = () => JSON.parse(readFileSync(join(FIXTURES, 'scene.sample.json'), 'utf8')) as Json;

let root: string;

function write(path: string, content: string | Uint8Array) {
  const full = join(root, path);
  mkdirSync(dirname(full), { recursive: true });
  writeFileSync(full, content);
}

function writeManifest(zone: ZoneId, manifest: Json) {
  write(`zones/${zone}/manifest.json`, JSON.stringify(manifest, null, 2));
}

function writeGlb(zone: ZoneId, nodes: FixtureNode[]) {
  write(`zones/${zone}/${zone}.glb`, buildGlb(nodes));
}

/** A minimal valid zone for every route position; z3 is the design doc's sample. */
function writeCompleteRoute() {
  ZONE_ROUTE.forEach((zone, i) => {
    const isLast = i === ZONE_ROUTE.length - 1;
    if (zone === 'z3-cavern') {
      writeManifest(zone, sampleManifest());
      writeGlb(zone, [
        { name: 'GEO_cavern_dome' },
        { name: 'COL_cavern_floor' },
        { name: 'POI_cavern_reveal' },
        { name: 'TRG_cartrain_exit' },
        { name: 'INST_building_a' },
        { name: 'PTS_building_a', children: [{ name: 'p0' }, { name: 'p1' }] },
        { name: 'HERO_pyramid_LOD0' },
        { name: 'HERO_pyramid_LOD1' },
      ]);
      for (const f of ['paths/z3-cavern.theatre.json', 'amb_cavern_drone.ogg', 'amb_lake_water.ogg', 'ir_large_open.wav', 'pa_welcome.ogg']) {
        write(`zones/${zone}/${f}`, '');
      }
      return;
    }
    writeManifest(zone, {
      id: zone,
      glb: `${zone}.glb`,
      next: ZONE_ROUTE[i + 1] ?? null,
      prev: ZONE_ROUTE[i - 1] ?? null,
      spawn: { position: [0, 0, 0], yawDeg: 0 },
      transition: isLast ? null : { type: 'door', triggerNode: 'TRG_exit' },
      ambience: [],
      pois: [{ id: 'poi-start', node: 'POI_start', lingerSec: 2 }],
    });
    writeGlb(zone, [{ name: 'COL_floor' }, { name: 'POI_start' }, { name: 'TRG_exit' }, { name: 'POI_mark_gendo' }, { name: 'EVA_01' }]);
  });
  write('zones/z7-cage/scene.json', JSON.stringify(sampleScene()));
  write(
    'audio/music/cues.json',
    JSON.stringify({ track: 'cruel_angels_thesis_jp.ogg', cues: { intro: 0, swell_1: 30, chorus_1: 60, final_chorus: 120 } }),
  );
}

const errors = (issues: Issue[]) => issues.filter((i) => i.level === 'error');
const errorText = (issues: Issue[]) => errors(issues).map((i) => `${i.file}: ${i.message}`).join('\n');

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'geofront-validate-'));
  writeCompleteRoute();
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

describe('validate-manifests', () => {
  it('accepts the design-doc samples inside a complete route', () => {
    const issues = validatePublic(root);
    expect(errorText(issues)).toBe('');
    // The sample scene's dialogue line has no audio yet: a warning until T0.6.
    expect(issues.some((i) => i.level === 'warning' && i.message.includes('z7_gendo_01.ogg'))).toBe(true);
  });

  it('fails when "next" is missing', () => {
    const { next: _next, ...withoutNext } = sampleManifest();
    writeManifest('z3-cavern', withoutNext);
    expect(errorText(validatePublic(root))).toMatch(/zones\/z3-cavern\/manifest\.json: next:/);
  });

  it('fails when "next" disagrees with the route', () => {
    writeManifest('z3-cavern', { ...sampleManifest(), next: 'z5-corridors' });
    expect(errorText(validatePublic(root))).toMatch(/next is z5-corridors; the route says z4-pyramid/);
  });

  it('fails on a bad node prefix in the manifest', () => {
    const manifest = sampleManifest();
    writeManifest('z3-cavern', { ...manifest, transition: { type: 'vehicle', triggerNode: 'GEO_cartrain_exit' } });
    expect(errorText(validatePublic(root))).toMatch(/transition\.triggerNode: must be a valid TRG_ node name/);
  });

  it('fails on a bad node prefix inside the GLB', () => {
    writeGlb('z4-pyramid', [{ name: 'COL_floor' }, { name: 'POI_start' }, { name: 'TRG_exit' }, { name: 'pyramid_shell' }]);
    expect(errorText(validatePublic(root))).toMatch(/z4-pyramid\.glb: bad node name: "pyramid_shell" has no contract prefix/);
  });

  it('fails when a referenced file is missing', () => {
    rmSync(join(root, 'zones/z3-cavern/amb_lake_water.ogg'));
    rmSync(join(root, 'zones/z4-pyramid/z4-pyramid.glb'));
    const text = errorText(validatePublic(root));
    expect(text).toMatch(/ambience "amb_lake_water\.ogg" does not exist/);
    expect(text).toMatch(/glb "z4-pyramid\.glb" does not exist/);
  });

  it('fails when a manifest names a node the GLB does not have', () => {
    writeGlb('z3-cavern', [{ name: 'GEO_cavern_dome' }, { name: 'TRG_cartrain_exit' }]);
    expect(errorText(validatePublic(root))).toMatch(/POI poi-cavern-reveal node "POI_cavern_reveal" is not a node in the zone GLB/);
  });

  it('enforces unique lookup names, instancing pairs and HERO/CHR naming', () => {
    writeGlb('z5-corridors', [
      { name: 'COL_floor' },
      { name: 'POI_start' },
      { name: 'POI_start' },
      { name: 'TRG_exit' },
      { name: 'INST_pipe' },
      { name: 'HERO_door' },
      { name: 'CHR_kaworu' },
    ]);
    const text = errorText(validatePublic(root));
    expect(text).toMatch(/"POI_start" appears 2 times/);
    expect(text).toMatch(/"INST_pipe" has no matching "PTS_pipe"/);
    expect(text).toMatch(/"HERO_door" must look like HERO_<name>_LOD0/);
    expect(text).toMatch(/"CHR_kaworu" is not a known character/);
  });

  it('checks scene beats against cues, nodes and dialogue files', () => {
    const scene = sampleScene();
    const beats = scene.beats as Json[];
    beats.push({ id: 'b8', type: 'music', action: 'play', cue: 'chorus_9' });
    beats.push({ id: 'b9', type: 'move', character: 'CHR_misato', to: 'POI_nowhere' });
    write('zones/z7-cage/scene.json', JSON.stringify(scene));
    const text = errorText(validatePublic(root, { strictAssets: true }));
    expect(text).toMatch(/cue "chorus_9" is not in cues\.json/);
    expect(text).toMatch(/beat b9 mark "POI_nowhere" is not a node/);
    expect(text).toMatch(/audio\/lines\/z7_gendo_01\.ogg does not exist/);
    expect(text).toMatch(new RegExp(`audio/lines/${visemeFileFor('z7_gendo_01').replace('.', '\\.')} does not exist`));
  });

  it('requires the four score cues in order', () => {
    write('audio/music/cues.json', JSON.stringify({ track: 'cruel_angels_thesis_jp.ogg', cues: { intro: 0, swell_1: 90, chorus_1: 60 } }));
    const text = errorText(validatePublic(root));
    expect(text).toMatch(/cues\.chorus_1: "chorus_1" must come after/);
    expect(text).toMatch(/required cue "final_chorus" is missing/);
  });
});

describe('node name contract', () => {
  it.each([
    ['GEO_pyramid_shell', null],
    ['COL_corridor_floor', null],
    ['TRG_blastdoor_04', null],
    ['HERO_eva_unit_LOD0', null],
    ['CHR_op_maya', null],
    ['EVA_02', null],
    ['GEO_wall.001', null],
  ])('accepts %s', (name, expected) => {
    expect(nodeNameProblem(name)).toBe(expected);
  });

  it.each(['pyramid', 'Geo_wall', 'GEO_Wall', 'HERO_eva_unit', 'EVA_03', 'POI_', 'XYZ_thing'])('rejects %s', (name) => {
    expect(nodeNameProblem(name)).not.toBeNull();
  });
});
