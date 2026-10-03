/**
 * Data-contract validation for everything under public/: zone manifests, scene
 * timelines, music cues, and the node names inside each zone GLB.
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import type { z } from 'zod';
import { ZONE_ROUTE } from '../../src/config/world';
import { MusicCuesSchema, type MusicCues } from '../../src/contracts/cues';
import { ZoneManifestSchema, type ZoneManifest } from '../../src/contracts/manifest';
import {
  instancePartner,
  nodeNameProblem,
  nodePrefix,
  OPAQUE_PREFIXES,
  UNIQUE_PREFIXES,
} from '../../src/contracts/nodeNames';
import { SceneTimelineSchema, type SceneTimeline } from '../../src/contracts/scene';
import { readGlbJson, walkScene } from './glb';

export interface Issue {
  level: 'error' | 'warning';
  /** File the issue is about, relative to the validated root. */
  file: string;
  message: string;
}

export interface ValidateOptions {
  /** Treat missing dialogue audio and viseme files as errors (T0.6 onwards). */
  strictAssets?: boolean;
}

/** Viseme track that must sit beside each line's audio. */
export const visemeFileFor = (lineId: string) => `${lineId}.visemes.json`;

class Reporter {
  readonly issues: Issue[] = [];
  private readonly root: string;

  constructor(root: string) {
    this.root = root;
  }

  error(file: string, message: string) {
    this.issues.push({ level: 'error', file: relative(this.root, file), message });
  }

  warn(file: string, message: string) {
    this.issues.push({ level: 'warning', file: relative(this.root, file), message });
  }

  zod(file: string, error: z.ZodError) {
    for (const issue of error.issues) {
      const path = issue.path.length ? issue.path.map(String).join('.') : '(root)';
      this.error(file, `${path}: ${issue.message}`);
    }
  }
}

function readJson(file: string, report: Reporter): unknown {
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as unknown;
  } catch (err) {
    report.error(file, `cannot read JSON: ${err instanceof Error ? err.message : String(err)}`);
    return undefined;
  }
}

interface GlbIndex {
  names: Set<string>;
}

function inspectGlb(file: string, report: Reporter): GlbIndex | null {
  let gltf;
  try {
    gltf = readGlbJson(new Uint8Array(readFileSync(file)));
  } catch (err) {
    report.error(file, `cannot read GLB: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
  const names = new Set<string>();
  const seen = new Map<string, number>();
  for (const { node, ancestors } of walkScene(gltf)) {
    const insideOpaque = ancestors.some((a) => {
      const p = a.name ? nodePrefix(a.name) : null;
      return p !== null && OPAQUE_PREFIXES.includes(p);
    });
    if (insideOpaque) continue;
    if (!node.name) {
      report.error(file, 'a node has no name; every node needs a contract prefix');
      continue;
    }
    const problem = nodeNameProblem(node.name);
    if (problem) report.error(file, `bad node name: ${problem}`);
    names.add(node.name);
    seen.set(node.name, (seen.get(node.name) ?? 0) + 1);
  }
  for (const [name, count] of seen) {
    const prefix = nodePrefix(name);
    if (count > 1 && prefix && UNIQUE_PREFIXES.includes(prefix)) {
      report.error(file, `node "${name}" appears ${count} times; ${prefix}_ names must be unique`);
    }
  }
  for (const name of names) {
    const partner = instancePartner(name);
    if (partner && !names.has(partner)) report.error(file, `"${name}" has no matching "${partner}"`);
  }
  return { names };
}

function requireFile(zoneDir: string, path: string, what: string, from: string, report: Reporter) {
  const full = join(zoneDir, path);
  if (!existsSync(full)) report.error(from, `${what} "${path}" does not exist`);
}

function requireNode(glb: GlbIndex | null, name: string, what: string, from: string, report: Reporter) {
  if (glb && !glb.names.has(name)) report.error(from, `${what} "${name}" is not a node in the zone GLB`);
}

interface ZoneResult {
  manifest: ZoneManifest;
  dir: string;
}

function validateZone(
  zonesDir: string,
  folder: string,
  cues: MusicCues | null,
  linesDir: string,
  options: ValidateOptions,
  report: Reporter,
): ZoneResult | null {
  const dir = join(zonesDir, folder);
  const manifestFile = join(dir, 'manifest.json');
  if (!existsSync(manifestFile)) {
    report.error(dir, 'zone folder has no manifest.json');
    return null;
  }
  const raw = readJson(manifestFile, report);
  if (raw === undefined) return null;
  const parsed = ZoneManifestSchema.safeParse(raw);
  if (!parsed.success) {
    report.zod(manifestFile, parsed.error);
    return null;
  }
  const manifest = parsed.data;
  if (manifest.id !== folder) report.error(manifestFile, `id "${manifest.id}" does not match its folder "${folder}"`);

  requireFile(dir, manifest.glb, 'glb', manifestFile, report);
  if (manifest.guidedPath) requireFile(dir, manifest.guidedPath, 'guidedPath', manifestFile, report);
  if (manifest.reverb) requireFile(dir, manifest.reverb, 'reverb', manifestFile, report);
  for (const a of manifest.ambience) requireFile(dir, a, 'ambience', manifestFile, report);

  const glbFile = join(dir, manifest.glb);
  const glb = existsSync(glbFile) ? inspectGlb(glbFile, report) : null;

  const poiIds = new Set<string>();
  for (const poi of manifest.pois) {
    if (poiIds.has(poi.id)) report.error(manifestFile, `duplicate POI id "${poi.id}"`);
    poiIds.add(poi.id);
    requireNode(glb, poi.node, `POI ${poi.id} node`, manifestFile, report);
    const event = poi.event;
    if (!event) continue;
    switch (event.type) {
      case 'pa':
        requireFile(dir, event.audio, `POI ${poi.id} PA audio`, manifestFile, report);
        break;
      case 'terminal':
        requireNode(glb, event.screen, `POI ${poi.id} terminal screen`, manifestFile, report);
        break;
      case 'door':
        requireNode(glb, event.node, `POI ${poi.id} door`, manifestFile, report);
        break;
      case 'card':
        requireNode(glb, event.reader, `POI ${poi.id} card reader`, manifestFile, report);
        if (event.opens) requireNode(glb, event.opens, `POI ${poi.id} door`, manifestFile, report);
        break;
    }
  }
  if (manifest.transition) requireNode(glb, manifest.transition.triggerNode, 'transition trigger', manifestFile, report);
  for (const other of manifest.alsoVisible ?? []) {
    if (!existsSync(join(zonesDir, other, 'manifest.json'))) report.error(manifestFile, `alsoVisible zone "${other}" does not exist`);
  }

  const sceneFile = join(dir, 'scene.json');
  if (existsSync(sceneFile)) {
    validateScene(sceneFile, manifest, glb, poiIds, cues, linesDir, options, report);
  } else {
    report.warn(manifestFile, 'no scene.json yet (the scene director needs one per zone)');
  }
  return { manifest, dir };
}

function validateScene(
  file: string,
  manifest: ZoneManifest,
  glb: GlbIndex | null,
  poiIds: Set<string>,
  cues: MusicCues | null,
  linesDir: string,
  options: ValidateOptions,
  report: Reporter,
) {
  const raw = readJson(file, report);
  if (raw === undefined) return;
  const parsed = SceneTimelineSchema.safeParse(raw);
  if (!parsed.success) {
    report.zod(file, parsed.error);
    return;
  }
  const scene: SceneTimeline = parsed.data;
  if (scene.scene !== manifest.id) report.error(file, `scene "${scene.scene}" does not match zone "${manifest.id}"`);
  const isActor = (name: string) => name.startsWith('CHR_') || name.startsWith('EVA_');
  const checkTarget = (target: string, what: string) => {
    if (isActor(target)) {
      const problem = nodeNameProblem(target);
      if (problem) report.error(file, `${what}: ${problem}`);
    } else {
      requireNode(glb, target, what, file, report);
    }
  };
  for (const beat of scene.beats) {
    const where = `beat ${beat.id}`;
    switch (beat.type) {
      case 'camera':
        if (beat.lookAt) checkTarget(beat.lookAt, `${where} lookAt`);
        break;
      case 'wait':
        if (beat.target) checkTarget(beat.target, `${where} target`);
        break;
      case 'move':
        requireNode(glb, beat.to, `${where} mark`, file, report);
        break;
      case 'music':
        if (beat.cue && cues && cues.cues[beat.cue] === undefined) report.error(file, `${where}: cue "${beat.cue}" is not in cues.json`);
        break;
      case 'event':
        if (!poiIds.has(beat.poi)) report.error(file, `${where}: POI "${beat.poi}" is not in the manifest`);
        break;
      case 'line': {
        const missing = [`${beat.lineId}.ogg`, visemeFileFor(beat.lineId)].filter((f) => !existsSync(join(linesDir, f)));
        for (const f of missing) {
          const message = `${where}: dialogue file audio/lines/${f} does not exist`;
          if (options.strictAssets) report.error(file, message);
          else report.warn(file, message);
        }
        break;
      }
      case 'lights':
      case 'anim':
      case 'control':
        break;
    }
  }
}

function validateCues(musicDir: string, report: Reporter): MusicCues | null {
  const file = join(musicDir, 'cues.json');
  if (!existsSync(file)) {
    report.warn(musicDir, 'no cues.json yet');
    return null;
  }
  const raw = readJson(file, report);
  if (raw === undefined) return null;
  const parsed = MusicCuesSchema.safeParse(raw);
  if (!parsed.success) {
    report.zod(file, parsed.error);
    return null;
  }
  if (parsed.data.provisional) report.warn(file, 'cue points are provisional; set them against the supplied track');
  if (!existsSync(join(musicDir, parsed.data.track))) {
    report.warn(file, `track "${parsed.data.track}" is not present (supplied locally, never committed)`);
  }
  return parsed.data;
}

function validateRoute(zones: ZoneResult[], zonesDir: string, report: Reporter) {
  for (const { manifest, dir } of zones) {
    const file = join(dir, 'manifest.json');
    const index = ZONE_ROUTE.indexOf(manifest.id);
    const expectedPrev = ZONE_ROUTE[index - 1] ?? null;
    const expectedNext = ZONE_ROUTE[index + 1] ?? null;
    if (manifest.prev !== expectedPrev) report.error(file, `prev is ${String(manifest.prev)}; the route says ${String(expectedPrev)}`);
    if (manifest.next !== expectedNext) report.error(file, `next is ${String(manifest.next)}; the route says ${String(expectedNext)}`);
    for (const neighbour of [manifest.prev, manifest.next]) {
      if (neighbour && !existsSync(join(zonesDir, neighbour, 'manifest.json'))) {
        report.error(file, `neighbouring zone "${neighbour}" has no manifest.json`);
      }
    }
    if (manifest.next !== null && manifest.transition === null) report.error(file, 'a zone with a next zone needs a transition');
  }
}

/** Validates everything under a public/ directory. */
export function validatePublic(publicDir: string, options: ValidateOptions = {}): Issue[] {
  const report = new Reporter(publicDir);
  const zonesDir = join(publicDir, 'zones');
  const cues = validateCues(join(publicDir, 'audio', 'music'), report);
  const linesDir = join(publicDir, 'audio', 'lines');
  const folders = existsSync(zonesDir)
    ? readdirSync(zonesDir).filter((f) => statSync(join(zonesDir, f)).isDirectory())
    : [];
  const zones: ZoneResult[] = [];
  for (const folder of folders) {
    const result = validateZone(zonesDir, folder, cues, linesDir, options, report);
    if (result) zones.push(result);
  }
  validateRoute(zones, zonesDir, report);
  return report.issues;
}
