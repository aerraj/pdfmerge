/**
 * Verifies a production build contains no developer tooling (AGENTS.md rule 3):
 * the dev overlay and bench runner must be stripped by Vite's dead-code elimination.
 * Run automatically after `pnpm build`.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEV_MARKERS } from './lib/devMarkers';

const dist = resolve(import.meta.dirname, '../dist');

function* files(dir: string): Generator<string> {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (/\.(js|html|css)$/.test(name)) yield path;
  }
}

const offenders: string[] = [];
for (const file of files(dist)) {
  const text = readFileSync(file, 'utf8');
  for (const marker of DEV_MARKERS) if (text.includes(marker)) offenders.push(`${file}: contains "${marker}"`);
}

if (offenders.length > 0) {
  console.error('[check-prod-build] developer code leaked into the production build:');
  for (const o of offenders) console.error(`  ${o}`);
  process.exit(1);
}
console.log('[check-prod-build] production bundle is free of developer tooling');
