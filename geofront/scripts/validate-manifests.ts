/**
 * pnpm validate: checks zone manifests, scene timelines, music cues and GLB node names
 * against the data contracts (src/contracts). Exits non-zero on any error.
 *
 *   pnpm validate                  validate public/
 *   pnpm validate --strict-assets  also fail on missing dialogue audio/visemes
 *   pnpm validate --root <dir>     validate another public-style directory
 */
import { resolve } from 'node:path';
import { parseArgs } from 'node:util';
import { validatePublic } from './lib/validate';

const { values } = parseArgs({
  options: {
    root: { type: 'string', default: resolve(import.meta.dirname, '../public') },
    'strict-assets': { type: 'boolean', default: false },
  },
});

const issues = validatePublic(resolve(values.root), { strictAssets: values['strict-assets'] });
const errors = issues.filter((i) => i.level === 'error');
const warnings = issues.filter((i) => i.level === 'warning');
for (const i of warnings) console.warn(`warning  ${i.file}: ${i.message}`);
for (const i of errors) console.error(`error    ${i.file}: ${i.message}`);
console.log(`[validate] ${errors.length} error(s), ${warnings.length} warning(s)`);
if (errors.length > 0) process.exit(1);
