# PROGRESS.md

Status of every backlog task. Updated in the same commit as the task.
Legend: ✅ done · 🔄 in progress · ⏸ blocked (reason given) · ⬜ not started

## Foundation (T0)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| T0.1 | Scaffold repo, pnpm scripts, strict TS, ESLint, Vitest, Playwright | ✅ | All commands green on an empty scene; bench 60 fps (SwiftShader) |
| T0.2 | Config files with documented values | ✅ | Unit + source tag on every constant is checked by a test; eye height 1.50 m (D-011) |
| T0.3 | Manifest Zod schemas and validate-manifests.ts | ✅ | Manifest, scene, cue and GLB node-name checks; doc samples are test fixtures (D-014) |
| T0.4 | Evaluate AI tools; adapters in scripts/ai/ | ⬜ | |
| T0.5 | `pnpm gen <asset-id>` | ⬜ | |
| T0.6 | `pnpm voice` and `pnpm lipsync` | ⬜ | |
| T0.7 | Review flow: REVIEW.md approvals promote assets | ⬜ | |

## Greybox (T1)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| T1.1 | Renderer: WebGPU + WebGL 2 fallback, tone mapping, depth | ⬜ | |
| T1.2 | Procedural placeholder geometry for all 7 zones | ⬜ | |
| T1.3 | Zone streamer | ⬜ | |
| T1.4 | Free-roam controller (Rapier) | ⬜ | |
| T1.5 | `pnpm bench` route flight, per-zone report | ⬜ | |

## Experience systems (T2)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| T2.1 | Guided paths (Theatre.js), guided ↔ free handover | ⬜ | |
| T2.2 | Vehicle rig (cartrain, escalators) | ⬜ | |
| T2.3 | Terminal system | ⬜ | |
| T2.4 | In-world loading sequence and transitions | ⬜ | |
| T2.5 | POI event system | ⬜ | |
| T2.6 | Scene director | ⬜ | |
| T2.7 | Character system with capsule placeholders | ⬜ | |
| T2.8 | Lip sync and spatial voice | ⬜ | |
| T2.9 | Music director | ⬜ | |
| T2.10 | Smoothness pass | ⬜ | |

## Environments (T3), interiors (T4), polish (T5), ship (T6)

| ID | Task | Status | Notes |
|----|------|--------|-------|
| T3.1 | Cavern environment | ⬜ | |
| T3.2 | Instanced city and forest, LOD, impostors | ⬜ | |
| T3.3 | (art) Swap in cavern and pyramid GLBs | ⬜ | |
| T3.4 | Generate hero assets first | ⬜ | |
| T4.1 | Interior lighting | ⬜ | |
| T4.2 | Command centre live screens | ⬜ | |
| T4.3 | Cage set-piece | ⬜ | |
| T4.4 | (art) Swap in interior kits, command centre, Eva | ⬜ | |
| T4.5 | (art) Swap in character GLBs and Eva hero assets | ⬜ | |
| T4.6 | Per-beat cinematic lighting and depth of field | ⬜ | |
| T5.1 | Spatial audio | ⬜ | |
| T5.2 | Post-processing pass | ⬜ | |
| T5.3 | Quality controller | ⬜ | |
| T6.1 | Production build and deploy | ⬜ | |
| T6.2 | README for setup, artists, IP note | ⬜ | |
