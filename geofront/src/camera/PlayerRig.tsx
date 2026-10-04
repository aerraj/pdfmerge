import { useFrame, useThree } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import { MathUtils, Vector3 } from 'three';
import { HEAD_BOB, LOOK, PHYSICS, WALK } from '../config/movement';
import { SHINJI } from '../config/scale';
import { input } from '../core/input/input';
import { PhysicsWorld } from '../core/physics/physicsWorld';
import { loadRapier } from '../core/physics/rapier';
import { ShinjiBody } from '../core/physics/shinjiBody';
import { playerState } from '../core/playerState';
import { simulation } from '../core/simulation';
import { useGeoStore } from '../core/store';
import { activeStreamer, onZoneEvicted, onZoneReady } from '../core/zones/runtime';
import { damp, nearestAngleDeg, stepCriticalSpring, type Spring } from './springs';

/** Longest frame the simulation will catch up on, s; beyond that time is dropped. */
const MAX_FRAME_SEC = 0.25;
/** An exponential approach is within 1/20 (95 %) of its target after log2(20) half-lives. */
const RESIDUAL_FRACTION_INVERSE = 20;
const HALF_LIVES_TO_95 = Math.log2(RESIDUAL_FRACTION_INVERSE);
/** Height of the point tested against zone triggers, m above the feet. */
const TRIGGER_PROBE_M = 1;
const TWO_PI = Math.PI * 2;

interface RigState {
  physics: PhysicsWorld | null;
  body: ShinjiBody | null;
  yaw: Spring;
  pitch: Spring;
  targetYawDeg: number;
  targetPitchDeg: number;
  velocityX: number;
  velocityZ: number;
  accumulator: number;
  bobPhase: number;
  bobWeight: number;
  handledTeleport: number;
}

const scratch = new Vector3();
const probe = new Vector3();

/**
 * Shinji in free roam: input → look springs → walking velocity → fixed-step character
 * physics → interpolated, head-bobbed first-person camera. Also fires zone transitions
 * when Shinji's body enters the current zone's transition trigger.
 */
export function PlayerRig() {
  const get = useThree((s) => s.get);
  const rig = useRef<RigState>({
    physics: null,
    body: null,
    yaw: { x: 0, v: 0 },
    pitch: { x: 0, v: 0 },
    targetYawDeg: 0,
    targetPitchDeg: 0,
    velocityX: 0,
    velocityZ: 0,
    accumulator: 0,
    bobPhase: 0,
    bobWeight: 0,
    handledTeleport: 0,
  });

  useEffect(() => {
    const r = rig.current;
    const detachInput = input.attach(get().gl.domElement);
    let cancelled = false;
    const unsubscribers: (() => void)[] = [detachInput];
    void loadRapier().then((rapier) => {
      if (cancelled) return;
      const physics = new PhysicsWorld(rapier);
      r.physics = physics;
      for (const zone of activeStreamer()?.ready() ?? []) physics.addZone(zone);
      unsubscribers.push(
        onZoneReady((zone) => {
          physics.addZone(zone);
        }),
        onZoneEvicted((zone) => {
          physics.removeZone(zone.id);
        }),
      );
    });
    return () => {
      cancelled = true;
      for (const u of unsubscribers) u();
      r.body?.dispose();
      r.physics?.dispose();
      r.body = null;
      r.physics = null;
      playerState.ready = false;
    };
  }, [get]);

  useFrame((_, delta) => {
    const r = rig.current;
    const { physics } = r;
    const store = useGeoStore.getState();
    if (!physics) return;
    const zone = activeStreamer()?.get(store.zone);

    // Spawn (start, dev jumps): wait until the zone and its collision exist. After that the
    // body keeps simulating even while a zone it walked into is still streaming in.
    if (!r.body || r.handledTeleport !== store.teleportSeq) {
      if (!zone || !physics.has(zone.id)) return;
      const [x, y, z] = zone.manifest.spawn.position;
      scratch.set(x, y, z);
      if (r.body) r.body.teleport(scratch);
      else r.body = new ShinjiBody(physics, scratch);
      r.targetYawDeg = zone.manifest.spawn.yawDeg;
      r.yaw = { x: r.targetYawDeg, v: 0 };
      r.targetPitchDeg = 0;
      r.pitch = { x: 0, v: 0 };
      r.velocityX = 0;
      r.velocityZ = 0;
      r.accumulator = 0;
      r.handledTeleport = store.teleportSeq;
    }
    const body = r.body;
    const dt = Math.min(delta, MAX_FRAME_SEC) * simulation.timeScale;
    const reduced = store.settings.reducedMotion;

    // Look: input moves the target; springs move the view.
    const frame = input.consume(dt, reduced ? LOOK.reducedMotionRateScale : 1);
    const override = input.override;
    r.targetYawDeg += frame.lookYawDeg;
    r.targetPitchDeg = MathUtils.clamp(r.targetPitchDeg + frame.lookPitchDeg, -LOOK.maxPitchDeg, LOOK.maxPitchDeg);
    if (override?.faceYawDeg != null) r.targetYawDeg = nearestAngleDeg(r.yaw.x, override.faceYawDeg);
    stepCriticalSpring(r.yaw, r.targetYawDeg, LOOK.smoothingHalfLifeSec, dt);
    stepCriticalSpring(r.pitch, r.targetPitchDeg, LOOK.smoothingHalfLifeSec, dt);

    // Walking: wish velocity in the world, eased in and out.
    const yaw = MathUtils.degToRad(r.yaw.x);
    let wishX: number;
    let wishZ: number;
    if (override?.worldDirection) {
      [wishX, wishZ] = override.worldDirection;
    } else {
      wishX = frame.moveRight * Math.cos(yaw) - frame.moveForward * Math.sin(yaw);
      wishZ = -frame.moveRight * Math.sin(yaw) - frame.moveForward * Math.cos(yaw);
    }
    const wishLength = Math.hypot(wishX, wishZ);
    if (wishLength > 1) {
      wishX /= wishLength;
      wishZ /= wishLength;
    }
    const easing = (wishLength > 0 ? WALK.accelTimeSec : WALK.decelTimeSec) / HALF_LIVES_TO_95;
    r.velocityX = damp(r.velocityX, wishX * WALK.speedMps, easing, dt);
    r.velocityZ = damp(r.velocityZ, wishZ * WALK.speedMps, easing, dt);

    // Fixed-step physics; render interpolates between the last two steps.
    r.accumulator += dt;
    let steps = 0;
    while (r.accumulator >= PHYSICS.fixedStepSec && steps < simulation.maxStepsPerFrame) {
      body.fixedStep(PHYSICS.fixedStepSec, r.velocityX, r.velocityZ);
      physics.step();
      r.accumulator -= PHYSICS.fixedStepSec;
      steps++;
    }
    if (steps === simulation.maxStepsPerFrame) r.accumulator = 0;
    const alpha = r.accumulator / PHYSICS.fixedStepSec;
    const feet = playerState.feet.lerpVectors(body.previous, body.current, alpha);

    // Zone transition. Walking, riding or passing a door carries Shinji across; a lift
    // moves him to the next zone's arrival point (the lift ride itself arrives in T2.4).
    const transition = zone?.manifest.transition;
    const next = zone?.manifest.next;
    if (zone && transition && next && zone.triggers.get(transition.triggerNode)?.contains(probe.copy(feet).setY(feet.y + TRIGGER_PROBE_M))) {
      if (transition.type === 'lift') store.teleportTo(next);
      else store.setZone(next);
    }
    // Fall safety net: below every loaded floor means a hole in collision; go back to spawn.
    const lowest = physics.lowestY();
    if (lowest !== null && feet.y < lowest - WALK.fallLimitM) {
      playerState.respawns += 1;
      store.teleportTo(store.zone);
    }

    // Head bob: one vertical dip per step, one sway per stride; off with reduced motion.
    const speedRatio = Math.min(1, Math.hypot(r.velocityX, r.velocityZ) / WALK.speedMps);
    r.bobWeight = damp(r.bobWeight, reduced || !body.grounded ? 0 : speedRatio, HEAD_BOB.fadeHalfLifeSec, dt);
    r.bobPhase = (r.bobPhase + HEAD_BOB.stepFrequencyHz * speedRatio * dt) % 2;
    const bobY = HEAD_BOB.verticalAmplitudeM * r.bobWeight * Math.sin(TWO_PI * r.bobPhase);
    const sway = HEAD_BOB.lateralAmplitudeM * r.bobWeight * Math.sin(Math.PI * r.bobPhase);

    const camera = get().camera;
    camera.position.set(feet.x + Math.cos(yaw) * sway, feet.y + SHINJI.eyeHeightM + bobY, feet.z - Math.sin(yaw) * sway);
    camera.rotation.set(MathUtils.degToRad(r.pitch.x), yaw, 0, 'YXZ');
    camera.updateMatrixWorld();

    playerState.yawDeg = r.yaw.x;
    playerState.pitchDeg = r.pitch.x;
    playerState.grounded = body.grounded;
    playerState.ready = true;
    playerState.simTimeSec += dt;
  });

  return null;
}
