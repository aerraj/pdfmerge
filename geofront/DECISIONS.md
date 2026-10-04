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

## D-014 · Contract details the doc leaves open (T0.3)

The Zod schemas in `src/contracts/` pin down what the doc's examples imply:

- **Paths** in a manifest are relative to the zone folder (`public/zones/<zone-id>/`).
- **`next`/`prev`** are required keys; `null` only at the ends of the route. The
  validator also checks them against `ZONE_ROUTE`, so the chain cannot drift.
- **`spawn.position`** is where Shinji's feet are; the camera adds the eye height (D-011).
- **`guidedPath`** and **`reverb`** may be absent or `null` until T2.1 and T5.1 author
  them; when present, the file must exist.
- **`transition`** is `null` only for the last zone; `type` is one of `vehicle`, `door`,
  `lift`, `walk` (the doc names vehicles, blast doors, lift rides and corridor turns).
- **POI events** are `pa`, `door`, `terminal` and `card` (T2.5's four event types).
- **`alsoVisible`** (optional, an addition): neighbouring zones kept visible while this
  zone is current, e.g. the cavern behind the pyramid arrival.
- **Node names**: every node outside a `PTS_`/`HERO_`/`CHR_`/`EVA_` subtree needs a
  prefix and a lowercase snake_case body; `HERO_` names end in `_LOD0..2`; `CHR_`/`EVA_`
  names come from the fixed lists; lookup prefixes (`POI_`, `TRG_`, `SCR_`, `LGT_`, …)
  must be unique; every `INST_x` needs a `PTS_x` and vice versa.
- **Dialogue**: `public/audio/lines/<lineId>.ogg` plus `<lineId>.visemes.json`. Line IDs
  look like `z7_gendo_01`. Missing line files are warnings until T0.6, then
  `pnpm validate --strict-assets` makes them errors.
- **Music cues**: `{ "track", "provisional"?, "cues": { name: seconds } }`; `intro`,
  `swell_1`, `chorus_1`, `final_chorus` are required and must be in that order. The
  committed timestamps are provisional placeholders until set against the real track.
  The track itself is never committed (copyright); its absence is a warning.
- The GLB check reads only the JSON chunk, so it works on Meshopt/Draco-compressed files.

## D-015 · Reversed-Z on a float32 depth target, rendered through a TSL pass (T1.1)

The doc allows "logarithmic depth buffer or reversed-Z". Log depth writes fragment depth
in every shader, which disables early-Z and costs fill rate on exactly the devices that
are short of it (mobile, integrated GPUs). Reversed-Z on a float32 depth buffer keeps
early-Z and gives about 1e-7 relative precision at every distance. It only works with a
float depth buffer, and WebGL's default canvas framebuffer has 24-bit depth, so the scene
always renders through a `RenderPipeline` scene pass: three.js gives that pass a float32
depth texture whenever reversed-Z is on, on both backends. The pass is also where
post-processing will go (T5.2), so it costs nothing extra later. Proof:
`tests/e2e/renderer.spec.ts` renders quads 1e-5 × distance apart from 0.15 m to 10 km on
both backends with zero z-fighting, and a control run with a standard depth buffer shows
z-fighting from 1 km out. Post-processing uses three's TSL nodes, not pmndrs
`postprocessing`, which is WebGL-only and cannot run on the WebGPU renderer.

## D-016 · No React StrictMode around the canvas (T1.1)

StrictMode mounts components twice in development. For the canvas that means creating a
GPU device, destroying it and creating another; the destroyed device's pending error
scopes then reject ("Instance dropped in popErrorScope") and the dev build behaves
differently from production. StrictMode only ever affects dev builds, so it is off.

## D-017 · Browser tests run headed inside Xvfb on display-less Linux; WebGPU swizzle shim (T1.1)

Two environment findings from bringing up the WebGPU backend:

1. Headless Chromium on SwiftShader cannot present WebGPU to a canvas: even a bare
   WebGPU triangle loses its device on the first frame. A headed browser inside Xvfb
   works. `scripts/with-display.ts` wraps `pnpm test:e2e` and `pnpm bench` in `xvfb-run`
   when Linux has no `DISPLAY` (containers, CI); macOS and Windows run unchanged.
2. three.js r186 sends `swizzle: 'rgba'` in every texture-view descriptor. Chromium builds
   carrying the earlier draft of `texture-component-swizzle` type that member as a
   dictionary and throw on every `createView`, so nothing renders. Real visitors can hit
   this, so `src/scene/webgpuCompat.ts` probes once after the device is created and, only
   if the browser rejects the string form, drops the member from identity views (identity
   is the default). Installed shims are recorded in the store for diagnostics.

## D-018 · Two bench profiles: hardware and software (T1.1)

The bench gates on the doc's numbers (p99 ≤ 18 ms, no frame over 50 ms, draw calls and
triangles under budget) on both backends. Without a GPU, SwiftShader rasterises on the CPU
and cannot fill 1080p at 60 fps even for an empty frame, so a GPU-less run uses a 640×360
viewport ("software" profile). That run gates everything the code controls (CPU cost per
frame, streaming and compile hitches, draw calls, triangles) but not GPU fill rate. Fill rate
is gated by the "hardware" profile (1920×1080, real GPU): `GEOFRONT_GPU=hardware pnpm bench`
on the reference laptop. `bench/results.json` records the profile and renderer string. The
WebGL 2 run stays headless so it uses ANGLE/SwiftShader rather than the X server's GL.

## D-019 · Frame time is measured from vsync-aligned frame timestamps (T1.1)

Refines D-009. Timestamps come from `document.timeline.currentTime` inside the frame
callback, which is the animation frame's start time (what `requestAnimationFrame` passes),
not `performance.now()` at callback entry. Intervals then count frames actually presented:
16.7 ms when on time, 33.3 ms when a frame is missed. With `performance.now()` the
empty-scene p99 wandered between 17.2 and 18.6 ms on scheduling jitter alone, which would
make the 18 ms gate flaky without measuring anything a visitor sees.

## D-020 · Placeholders are real GLBs, generated by `pnpm assets` and committed (T1.2)

The doc asks for code-generated placeholders that approved GLBs can replace with no code
change. The placeholders are therefore not built at runtime: each zone's spec
(`src/zones/<zone-id>/placeholder.ts`, all numbers from `src/config/`) is written by
`pnpm assets` to a Meshopt-compressed GLB and its `manifest.json`, through the same
gltf-transform path authored zones take. The runtime only ever loads GLBs, so the loader,
streamer, colliders and validator are exercised exactly as they will be with real art.
Outputs are deterministic and committed (about 500 KB for all seven zones); a unit test
runs `pnpm assets --check` so stale placeholders fail CI. When an approved export exists
at `assets-src/<zone-id>/<zone-id>.glb`, `pnpm assets` optimises that instead and leaves
the zone's manifest to be maintained by hand. (Running Blender headless to export `.blend`
files belongs to the AI pipeline task T0.5.)

## D-021 · Zone boundaries sit at chokepoints, and each zone owns what you see from inside it (T1.2)

- The station hall belongs to z1 (street), not z2: the station is in view the whole time on
  the street, and z2 is streamed in behind it. z2 is the shaft alone, from the head of the
  shaft to the mouth; the z1 → z2 trigger is at the head of the shaft.
- The whole pyramid exterior (a `HERO_pyramid` LOD set) lives in z3 (cavern), because it
  is the centre of the reveal; z4 adds only the plaza, checkpoint and gate. Because the
  streamer keeps the previous zone loaded, the cavern and pyramid stay visible during the
  pyramid arrival (`alsoVisible: ["z3-cavern"]`).
- The plaza and pyramid entrance floor are 0.1 m above the cavern floor, so paving never
  sits exactly on top of the ground.
- The interiors are laid out so their lifts stack vertically (corridor lift → arrival
  lift in the cage; cage's second lift → back of the command centre), so lift rides
  (T2.4) can actually travel between them.

## D-022 · Contract semantics the doc leaves implicit (T1.2)

Recorded in `AGENTS.md` as well, because artists' exports must follow them:
- `POI_` empties mark where someone stands (feet on the floor) and face along their local
  -Z. Shinji's camera stands there at eye height; `POI_mark_<who>` empties are the
  characters' and Evas' marks.
- `TRG_` volumes are either an empty whose scale gives the box's half extents (a Blender
  cube empty of size 1) or a mesh whose world bounding box is the volume.
- `INST_x` instances are copies of the `INST_x` mesh placed at each child of `PTS_x`:
  instance matrix = point's world matrix × the source's local matrix. Keep `INST_`
  sources at the origin, unrotated.
- `SCR_` screens face their viewer along local +Z.
- `HERO_<name>_LOD0..2` become one LOD object; switch distances are in `HERO_LOD`.
- Yaw 0 faces -Z (north); +X runs from the street towards the pyramid (east).

## D-023 · Greybox scale choices for the route (T1.2)

All `[est]` (see D-013) and in `src/config/layout/`: a 220 m street with Japanese
left-hand traffic (Misato's eastbound car stops at Shinji's pavement); a 1.2 km shaft at
30°; a 2 km viaduct at about 15° from a mouth 520 m up the wall; escalator runs of 24 m
rise at 30°; a cage whose coolant is 150 m below the plaza, Unit-01 standing chest-deep
32 m down with its eye line 9 m above the coolant and 4 m from the boat; a command
centre 60 × 50 × 30 m with a 40 × 18 m screen. Free roam can walk on the lake surface in
the greybox (the floor collider ignores the lake); visitors only cross the cavern by car.

## D-024 · The scene renders at the top level; post-processing reads its textures (T1.3)

Supersedes the "TSL pass node" detail of D-015 (reversed-Z float depth stays). Profiling
the first frame of a freshly streamed zone showed 50–265 ms of main-thread node building
even after `compileAsync`. Cause: three.js keys render objects by render-call depth, and a
`pass()` node renders the scene nested inside the output quad, a depth `compileAsync`
never uses, so precompiled objects were never the ones drawn. `FramePipeline`
(`src/scene/renderPipeline.ts`) now renders the scene itself into a target it owns
(half-float colour; float32 depth with reversed-Z) and the `RenderPipeline` only reads
that texture (tone mapping now, bloom/SMAA/grain in T5.2). Precompile binds the same
target, disables frustum culling and exposes every LOD level for the synchronous
gathering step, so a zone that comes into view builds nothing: worst main-thread frame
across three route loops is 7.5 ms.

## D-025 · Without a GPU the bench gates main-thread time; with one it also gates intervals (T1.3)

Refines D-018. On SwiftShader the GPU process JIT-compiles each new pipeline the first
time it draws and rasterises on the same CPU cores, so the first frame showing a new
zone stalls for 170–220 ms with **zero** main-thread cost, and WebGPU-on-SwiftShader
needs about 50 ms to draw the cavern. Neither says anything about this code on a real GPU,
where pipelines compile asynchronously at creation. So:
- software profile (no GPU): gates main-thread frame time (p99 ≤ 18 ms, none over 50 ms),
  draw calls and triangles; frame intervals are reported, not gated;
- hardware profile (`GEOFRONT_GPU=hardware`): gates all of that plus the doc's interval
  budget (p99 ≤ 18 ms, no frame over 50 ms).
The streaming e2e test follows the same rule. **The interval half of T1.3's "no hitch over
50 ms at transitions" therefore still needs one run on the reference laptop.** If drivers
there do compile lazily on first draw, the fix is a warm-up draw of each streamed zone
into a 1×1 target of the same format during the transition chokepoint (T2.10).
