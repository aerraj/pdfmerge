# GeoFront

A browser-based, real-time, first-person recreation of Shinji Ikari's arrival at NERV
headquarters in episode 1 of *Neon Genesis Evangelion*: the empty Tokyo-3 street, the
cartrain descent, the GeoFront opening up below, the pyramid, the corridors, the cage
where Unit-01 is suddenly face to face with you, and the command centre for the launch.

Built by Rishabh Raj as a personal, non-commercial project.

## IP note

*Neon Genesis Evangelion*, its characters, the Evangelion units, NERV and all related
names, designs and marks belong to khara, Inc. and their respective owners. This is an
unofficial, non-commercial fan recreation made for personal study and is not affiliated
with or endorsed by them. No assets are ripped from the series or from games: all models,
textures and voices are generated for this project. "A Cruel Angel's Thesis" is not
included in this repository; it is supplied locally by the owner and must be fully
licensed before any public release.

This note lives here and only here: nothing in the experience itself shows titles,
credits or watermarks (design doc, "No fourth wall").

## Requirements

- Node.js 22.18 or newer
- pnpm 10.28 (`corepack enable` picks up the version pinned in `package.json`)
- For browser tests: Chromium via Playwright (`pnpm exec playwright install chromium`)

## Setup

```sh
cd geofront
pnpm install
pnpm dev          # http://localhost:5173 — press ` (backtick) for the dev overlay
```

## Commands

| Command | Does |
|---------|------|
| `pnpm dev` | Local dev server with the dev overlay available |
| `pnpm build` | Production build; fails if any developer code leaks into `dist/` |
| `pnpm preview` | Serves the production build |
| `pnpm assets` | Builds `assets-src/` (or code placeholders) into `public/zones/` |
| `pnpm validate` | Validates manifests, scene timelines, music cues and GLB node names |
| `pnpm typecheck` | TypeScript, strict mode |
| `pnpm lint` | ESLint (type-aware; enforces no magic numbers outside `src/config/`) |
| `pnpm test` | Vitest unit tests, then Playwright end-to-end tests |
| `pnpm bench` | Flies the route headless and writes per-zone frame times to `bench/results.json`; fails over budget |

Without a GPU (CI, containers) the browser tests and bench run on SwiftShader, headed
inside Xvfb on Linux (headless Chromium cannot present WebGPU there); the bench then uses
its small "software" viewport. On a machine with a real GPU, run
`GEOFRONT_GPU=hardware pnpm bench` to measure the GPU at 1080p. `?backend=webgl` or
`?backend=webgpu` in the URL forces a renderer backend in any build.

## Repository layout

```
AGENTS.md            condensed agent brief + conventions
DECISIONS.md         judgement calls and why
PROGRESS.md          backlog status
references/<zone>/   reference stills per zone (supplied locally)
assets-src/          .blend sources (Git LFS)
assets-review/       generated assets awaiting approval
public/zones/<zone>/ built GLB, textures, manifest.json, scene.json
scripts/             asset build, manifest validation, build checks
src/config/          every tunable number
src/core/            store, zone streamer, input, quality controller
src/scene/           canvas root, environment, post-processing
src/zones/<zone>/    per-zone placeholder geometry and logic
src/camera/          guided paths, free-roam controller, vehicle rig
src/terminals/       in-world screen UIs
src/audio/           ambience, PA, footsteps, music
src/dev/             dev overlay and bench runner (never in production)
tests/               unit, e2e and bench suites
```

## Music

Place the supplied track at `public/audio/music/cruel_angels_thesis_jp.ogg` (ignored by
git) and set its cue points in `public/audio/music/cues.json`.

## Credits

Design and direction: Rishabh Raj. See `DECISIONS.md` for the tools chosen for each stage
of the AI asset pipeline once they are evaluated.
