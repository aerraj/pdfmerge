/**
 * pnpm assets: builds every zone into public/zones/<zone-id>/.
 *
 * - An authored zone (assets-src/<zone-id>/<zone-id>.glb, exported from Blender) is run
 *   through the same gltf-transform optimisation; its manifest.json is maintained by hand.
 * - Otherwise the zone's code placeholder (src/zones/<zone-id>/placeholder.ts) is written
 *   as a GLB together with its manifest.json.
 * Both are checked against the scale constants before anything is written.
 *
 *   pnpm assets            build everything
 *   pnpm assets --check    fail if committed outputs differ from a fresh build (CI)
 *   pnpm assets --zone z3-cavern
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { ZONE_ROUTE } from '../src/config/world';
import { ZoneManifestSchema } from '../src/contracts/manifest';
import { PLACEHOLDER_BUILDERS } from '../src/zones/placeholders';
import { createIO, measure, optimise, zoneToDocument } from './lib/zoneWriter';

const ROOT = resolve(import.meta.dirname, '..');
const { values } = parseArgs({ options: { check: { type: 'boolean', default: false }, zone: { type: 'string' } } });

const io = await createIO();
const problems: string[] = [];
const stale: string[] = [];

function emit(path: string, content: Uint8Array | string) {
  const bytes = typeof content === 'string' ? new TextEncoder().encode(content) : content;
  if (values.check) {
    if (!existsSync(path) || Buffer.compare(readFileSync(path), Buffer.from(bytes)) !== 0) stale.push(path);
    return;
  }
  mkdirSync(resolve(path, '..'), { recursive: true });
  writeFileSync(path, bytes);
}

for (const zone of ZONE_ROUTE) {
  if (values.zone && values.zone !== zone) continue;
  const outDir = join(ROOT, 'public', 'zones', zone);
  const authored = join(ROOT, 'assets-src', zone, `${zone}.glb`);
  if (existsSync(authored)) {
    const doc = await io.read(authored);
    await optimise(doc);
    emit(join(outDir, `${zone}.glb`), await io.writeBinary(doc));
    console.log(`[assets] ${zone}: authored GLB optimised`);
    continue;
  }
  const spec = PLACEHOLDER_BUILDERS[zone]();
  const manifest = ZoneManifestSchema.parse(spec.manifest);
  const doc = zoneToDocument(spec);
  await optimise(doc);
  for (const check of spec.scaleChecks) {
    const measured = measure(doc, check);
    if (measured === null) problems.push(`${zone}: scale check node ${check.node} is missing`);
    else if (Math.abs(measured - check.expectedM) > check.expectedM * check.tolerance) {
      problems.push(`${zone}: ${check.node} measures ${measured.toFixed(2)} m along ${check.axis}, expected ${check.expectedM} m`);
    }
  }
  emit(join(outDir, `${zone}.glb`), await io.writeBinary(doc));
  emit(join(outDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`[assets] ${zone}: placeholder written`);
}

for (const p of problems) console.error(`[assets] ${p}`);
if (stale.length) {
  console.error('[assets] these outputs are out of date; run pnpm assets and commit:');
  for (const s of stale) console.error(`  ${s}`);
}
if (problems.length || stale.length) process.exit(1);
