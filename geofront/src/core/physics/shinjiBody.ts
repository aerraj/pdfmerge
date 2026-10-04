import type { Collider, KinematicCharacterController, RigidBody } from '@dimforge/rapier3d-compat';
import { MathUtils, Vector3 } from 'three';
import { WALK } from '../../config/movement';
import { SHINJI } from '../../config/scale';
import type { PhysicsWorld } from './physicsWorld';

const UP = { x: 0, y: 1, z: 0 };
/** Collision capsule: total height = stature, cylinder half-height in between the caps. */
const HALF_HEIGHT = (SHINJI.statureM - 2 * SHINJI.bodyRadiusM) / 2;
/** Capsule centre above the feet (the controller keeps a skin gap below). */
const CENTRE_ABOVE_FEET = HALF_HEIGHT + SHINJI.bodyRadiusM + WALK.skinM;

/**
 * Shinji's body: a kinematic capsule moved by Rapier's character controller (auto-step,
 * snap to ground, slope limits) with gravity integrated here. Positions are feet
 * positions; `previous` and `current` are the last two fixed steps, for interpolation.
 */
export class ShinjiBody {
  readonly previous = new Vector3();
  readonly current = new Vector3();
  grounded = false;
  private verticalSpeed = 0;
  private readonly body: RigidBody;
  private readonly collider: Collider;
  private readonly controller: KinematicCharacterController;
  private readonly physics: PhysicsWorld;

  constructor(physics: PhysicsWorld, feet: Vector3) {
    this.physics = physics;
    const { rapier, world } = physics;
    this.body = world.createRigidBody(rapier.RigidBodyDesc.kinematicPositionBased().setTranslation(feet.x, feet.y + CENTRE_ABOVE_FEET, feet.z));
    this.collider = world.createCollider(rapier.ColliderDesc.capsule(HALF_HEIGHT, SHINJI.bodyRadiusM), this.body);
    this.controller = world.createCharacterController(WALK.skinM);
    this.controller.setUp(UP);
    this.controller.enableAutostep(WALK.maxStepM, WALK.minStepWidthM, false);
    this.controller.enableSnapToGround(WALK.snapToGroundM);
    this.controller.setMaxSlopeClimbAngle(MathUtils.degToRad(WALK.maxSlopeDeg));
    this.controller.setMinSlopeSlideAngle(MathUtils.degToRad(WALK.maxSlopeDeg));
    this.controller.setSlideEnabled(true);
    this.current.copy(feet);
    this.previous.copy(feet);
  }

  /** Places the feet at a point instantly (spawn, respawn). */
  teleport(feet: Vector3): void {
    this.body.setTranslation({ x: feet.x, y: feet.y + CENTRE_ABOVE_FEET, z: feet.z }, true);
    this.verticalSpeed = 0;
    this.grounded = false;
    this.current.copy(feet);
    this.previous.copy(feet);
    this.physics.step();
  }

  /** One fixed physics step with the given horizontal velocity (m/s). */
  fixedStep(dt: number, velocityX: number, velocityZ: number): void {
    this.previous.copy(this.current);
    this.verticalSpeed = this.grounded ? 0 : Math.max(this.verticalSpeed - WALK.gravityMps2 * dt, -WALK.terminalFallSpeedMps);
    // A little downward motion while grounded keeps contact so ground snapping works.
    const vy = this.grounded ? -WALK.gravityMps2 * dt : this.verticalSpeed;
    this.controller.computeColliderMovement(this.collider, { x: velocityX * dt, y: vy * dt, z: velocityZ * dt });
    const move = this.controller.computedMovement();
    this.grounded = this.controller.computedGrounded();
    const t = this.body.translation();
    const next = { x: t.x + move.x, y: t.y + move.y, z: t.z + move.z };
    this.body.setNextKinematicTranslation(next);
    this.current.set(next.x, next.y - CENTRE_ABOVE_FEET, next.z);
  }

  dispose(): void {
    this.physics.world.removeCharacterController(this.controller);
    this.physics.world.removeRigidBody(this.body);
  }
}
