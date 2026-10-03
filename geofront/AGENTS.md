# AGENTS.md — GeoFront agent brief

Condensed from the design document ("GeoFront Virtual Tour — Design Document & Roadmap",
2 Oct 2026). The design document is the specification; this file is the working copy of
its rules for anyone (human or agent) changing this repository.

## What we are building

A browser-based, real-time, first-person recreation of Shinji's arrival at NERV HQ in
episode 1. The visitor *is* Shinji (eye height in `src/config/scale.ts`). Seven scenes,
streamed as zones, 10–15 minutes end to end. Nothing on screen breaks the illusion.

Scene order (note: the cage comes **before** the command centre):

| # | Zone ID | Place |
|---|---------|-------|
| 1 | `z1-surface` | Tokyo-3 street |
| 2 | `z2-descent` | Car on the cartrain |
| 3 | `z3-cavern` | GeoFront reveal |
| 4 | `z4-pyramid` | Pyramid arrival |
| 5 | `z5-corridors` | HQ corridors |
| 6 | `z7-cage` | Cage, Unit-01 reveal |
| 7 | `z6-command` | Command centre, launch |

## Rules (hard)

1. Sections marked "must" in the design doc are hard requirements; everything else is a
   default you may improve on, with the reason recorded in `DECISIONS.md`.
2. All art comes from the AI asset pipeline. Until a generated asset passes review, use
   code-generated placeholders at real-world scale whose node names match the data
   contracts, so approved GLBs drop in with no code change.
3. No non-diegetic text, buttons or overlays during the experience. The only exception is
   the developer overlay (backtick key), which is stripped from production builds;
   `pnpm build` fails if dev code leaks (`scripts/check-prod-build.ts`).
4. Tunable numbers (scale, speeds, fog, light intensities, budgets, colours) live in
   `src/config/`, never inline. ESLint's `no-magic-numbers` enforces this in `src/`.
5. After each task run `pnpm typecheck`, `pnpm lint`, `pnpm test` and `pnpm bench`. A task
   is done only when all pass and the bench stays inside the Performance budget.
6. Commit per task with the task ID first (`T2.3: zone streamer prefetch`) and update
   `PROGRESS.md`.
7. When the design doc is silent or ambiguous, pick what best preserves immersion, record
   it in `DECISIONS.md`, and keep going.
8. Build in backlog order, one task at a time; do not start a task until the previous one
   meets its acceptance criteria. Tasks marked (art) get a system plus a placeholder.

## Conventions

- TypeScript strict, no `any`; one React component per file (local ESLint rule).
- Units are metres and seconds unless a name says otherwise (`…Ms`, `…Deg`, `…Hz`).
- Y-up, right-handed; world origin is the centre of the GeoFront cavern floor. Every zone
  is authored in this shared world frame (see `DECISIONS.md`, D-010).
- Every object an artist will replace has a stable, prefixed name (below).
- Each tunable constant carries a unit and a source comment.
- Developer-only code lives in `src/dev/` and is imported only behind
  `import.meta.env.DEV` or `import.meta.env.MODE === 'bench'`.

## Data contracts (summary)

Code and art meet only through these; `pnpm validate` enforces them with Zod.

- Zone manifest: `public/zones/<zone-id>/manifest.json`
- Scene timeline: `public/zones/<zone-id>/scene.json`
- Music cues: `public/audio/music/cues.json`
- Dialogue: `public/audio/lines/<lineId>.ogg` plus a viseme file per line

GLB node prefixes: `GEO_` static geometry · `COL_` collision (hidden) · `INST_` instancing
source · `PTS_` instance points · `POI_` point of interest · `TRG_` trigger volume ·
`SCR_` live terminal screen · `LGT_` light placement · `HERO_` hero LOD set (`_LOD0..2`) ·
`CHR_<name>` rigged character · `EVA_<unit>` Evangelion unit.
Character clips: `idle`, `walk`, `talk`, `gesture_point`, `look_down`, `sit`.

## Commands

| Command | Does |
|---------|------|
| `pnpm dev` | Dev server with the dev overlay (backtick) |
| `pnpm build` | Production build, dev code stripped and verified |
| `pnpm assets` | Builds `assets-src/` (or placeholders) into `public/zones/` |
| `pnpm validate` | Validates manifests, scenes, cues and GLB node names |
| `pnpm typecheck` / `pnpm lint` | TypeScript strict / ESLint |
| `pnpm test` | Vitest unit tests, then Playwright end-to-end tests |
| `pnpm bench` | Flies the route headless, writes `bench/results.json`, fails over budget |

Headless runs use SwiftShader when there is no GPU. On a machine with a real GPU set
`GEOFRONT_GPU=hardware` so the bench measures it.
