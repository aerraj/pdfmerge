/** Layout of the T1.1 depth test scene, shared with the end-to-end test. */
export const DEPTH_TEST_DISTANCES = [0.15, 1, 10, 100, 1000, 5000, 10000] as const;
/** Back quad sits this fraction of the distance behind the front quad. */
export const DEPTH_GAP = 1e-5;
/** Strip layout in normalised device coordinates. */
export const STRIP_LAYOUT = { firstX: -0.84, stepX: 0.28, width: 0.2, bottomY: 0.15, topY: 0.85 } as const;

/** Names the root of every dev scene; scripts/check-prod-build.ts fails if it ships. */
export const DEV_SCENE_MARKER = 'geofront-dev-scene';
