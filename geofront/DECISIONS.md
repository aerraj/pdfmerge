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

## D-010 · One shared world frame for every zone (T0.2)

The conventions put the cavern centre at the origin; the doc does not say whether each
zone has its own origin. All seven zones are authored in one world frame (origin at the
centre of the cavern floor, Y-up): the Tokyo-3 street sits above the cavern at
`STREET_ELEVATION_M`, the cartrain shaft runs down through the crust to a mouth in the
cavern wall, and the interiors sit inside and below the pyramid (`src/config/world.ts`).
Why: the car must carry Shinji across zone boundaries (street → shaft → cavern → plaza)
with no seam or re-origin, the cavern must stay visible behind the pyramid arrival, and a
single frame lets camera splines cross zones. Float32 precision at the farthest point
(about 3.6 km out) is under 0.5 mm, well below anything visible.

## D-011 · Eye height is 1.50 m, not 1.65 m (T0.2)

The doc states Shinji's eye height as 1.50 m twice (Vision, Experience design), but the
T0.2 acceptance test and the manifest example use 1.65 m, an adult's eye height left over
from the earlier "tour" framing. The visitor is a 14-year-old; 1.50 m is the number the
experience is designed around, and it changes how the street, the car and Unit-01 feel.
`SHINJI.eyeHeightM = 1.5`, and the T0.2 test asserts 1.50 m. Manifest spawn positions are
floor positions plus this constant, never a hard-coded eye height.

## D-012 · "Guided mode 6–10 min" and "end to end 10–15 min" are both kept (T0.2)

Read together: a run where the visitor never touches anything (every wait beat times out,
every hold is minimal) takes 6–10 minutes; a normal run, with looking around and walking
between beats, takes 10–15. Both ranges live in `PACING`/`GUIDED` in
`src/config/movement.ts` and are checked separately once the scene director exists.

## D-013 · Placeholder dimensions are estimates until the reference boards exist (T0.2)

Open question 1 (canon scale) is unanswered and `references/` is empty, so the cavern uses
the doc's fan figures (6 km × 0.9 km) and everything without a published figure (pyramid
600 m × 400 m, crust 220 m, cage depth 32 m with a 40 m Eva, corridor 3.2 m × 3.0 m) is an
`[est]` value read from memory of ep01 framing. Every such constant is tagged `[est]` in
`src/config/scale.ts`; nothing downstream hard-codes them, so correcting them is a
one-file change followed by `pnpm assets`.
