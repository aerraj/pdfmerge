import { PHYSICS } from '../config/movement';

/**
 * Simulation clock controls. Production never changes them; dev and bench builds speed
 * time up so automated walks of a kilometre-long shaft finish in seconds, while physics
 * still runs at its fixed step (more steps per frame, not longer ones).
 */
export const simulation = {
  timeScale: 1,
  maxStepsPerFrame: PHYSICS.maxStepsPerFrame as number,
  /** Who moves the camera: Shinji's rig, or an external driver (the bench flight). */
  cameraOwner: 'player' as 'player' | 'external',
};
