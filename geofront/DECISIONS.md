# DECISIONS.md

Judgement calls made where the design document was silent, ambiguous or in conflict with
reality. Newest last. Each entry says what was decided, why, and what would change it.

## D-001 · Project lives in `geofront/` inside the current repository (T0.1)

The only repository this build has access to is `aerraj/pdfmerge`, so the project is a
self-contained folder (`geofront/`) with its own `package.json`, lockfile and CI workflow
(`.github/workflows/geofront.yml`, path-filtered so the PDF app's workflows never run for
GeoFront changes and vice versa). To move it to its own repository with history:
`git subtree split --prefix geofront -b geofront-only`, then push that branch.

## D-002 · TypeScript 6.0, not 7.0 (T0.1)

"Pin every dependency to the latest stable version" collides with ESLint: TypeScript 7.0.2
is the newest release, but `typescript-eslint` 8.71 (newest) supports only `<6.1`, and
type-aware lint is how rules 4 and "no `any`" are enforced. Pinned TypeScript 6.0.3.
Revisit when `typescript-eslint` supports 7.x.

## D-003 · pnpm 10.28 (T0.1)

pnpm 12.9 is the newest release, but the pre-installed, verified toolchain here is 10.28,
and the lockfile format is compatible with CI's `pnpm/action-setup`. `packageManager`
pins 10.28.0 so every machine uses the same version. Upgrading is a one-line change.

## D-004 · Playwright 1.63 with a shared-Chromium fallback (T0.1)

Playwright is pinned to the newest release. Where its own browser download is missing but
a shared cache exists (`$PLAYWRIGHT_BROWSERS_PATH/chromium`, as in preconfigured
containers), `tests/support/browser.ts` launches that Chromium instead of downloading one.
`GEOFRONT_CHROMIUM` overrides both.

## D-005 · Headless runs on SwiftShader; `GEOFRONT_GPU=hardware` for real GPUs (T0.1)

Containers and CI runners have no GPU. Chromium exposes both WebGL 2 (ANGLE on SwiftShader
Vulkan) and WebGPU (SwiftShader adapter, behind `--enable-unsafe-webgpu`) there, which is
enough to test both backends end to end. Frame times measured this way are CPU-rendered
and pessimistic for fill-rate-bound scenes; every `bench/results.json` records the renderer
string so results are never mistaken for a real-GPU run. On the reference laptop run
`GEOFRONT_GPU=hardware pnpm bench`.

## D-006 · `pnpm test` runs unit and end-to-end tests (T0.1)

The doc lists `pnpm test` as "Vitest". Several acceptance criteria (both render backends,
zones load, walk the route) can only be checked in a browser, and rule 5 makes `pnpm test`
the gate, so `pnpm test` = `vitest run` then the Playwright e2e suite. `test:unit` and
`test:e2e` run either half alone.

## D-007 · Lint enforces two conventions mechanically (T0.1)

- Rule 4 (no magic numbers outside `src/config/`) is enforced with
  `@typescript-eslint/no-magic-numbers` across `src/` (small integers and 0.5 allowed),
  switched off inside `src/config/`. Unit conversions are named local constants.
- "One React component per file" uses a 60-line local rule
  (`tools/eslint/one-component-per-file.js`) because `eslint-plugin-react` does not yet
  support ESLint 10.

## D-008 · Dev tooling is plain DOM, loaded only in dev/bench builds (T0.1)

The dev overlay and bench runner are imported behind `import.meta.env.DEV` and
`import.meta.env.MODE === 'bench'`; Vite removes both from production builds, and
`scripts/check-prod-build.ts` fails `pnpm build` if their marker strings appear in `dist/`.
The overlay is a DOM panel rather than `r3f-perf`, which does not support the WebGPU
renderer this project uses.

## D-009 · Bench measures the interval between rendered frames (T0.1)

Frame time = time between consecutive frames of the render loop, which is what a visitor
perceives as smoothness (it includes CPU, GPU back-pressure and any main-thread stall).
p99 and the hitch count come from that series. Draw calls and triangles are sampled from
the renderer each frame and reported alongside.
