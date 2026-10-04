import { LOOK, TOUCH } from '../../config/movement';

/** Intent for one frame, independent of the device that produced it. */
export interface InputFrame {
  /** Strafe, -1 (left) to 1 (right). */
  moveRight: number;
  /** Walk, -1 (back) to 1 (forward). */
  moveForward: number;
  /** Look change this frame, deg. Positive yaw turns left; positive pitch looks up. */
  lookYawDeg: number;
  lookPitchDeg: number;
}

/**
 * Direct control for tests and the bench: a world-space walking direction (x, z) and a
 * facing yaw. Installed only by dev and bench builds.
 */
export interface InputOverride {
  worldDirection: readonly [number, number] | null;
  faceYawDeg: number | null;
}

const FORWARD_KEYS = new Set(['KeyW', 'ArrowUp']);
const BACK_KEYS = new Set(['KeyS', 'ArrowDown']);
const LEFT_KEYS = new Set(['KeyA']);
const RIGHT_KEYS = new Set(['KeyD']);
const TURN_LEFT_KEYS = new Set(['ArrowLeft', 'KeyQ']);
const TURN_RIGHT_KEYS = new Set(['ArrowRight', 'KeyE']);
const LOOK_UP_KEYS = new Set(['PageUp']);
const LOOK_DOWN_KEYS = new Set(['PageDown']);

interface TouchStick {
  id: number;
  originX: number;
  originY: number;
  x: number;
  y: number;
}

const any = (keys: ReadonlySet<string>, held: ReadonlySet<string>) => [...keys].some((k) => held.has(k));

/**
 * Keyboard, mouse (pointer lock) and touch. Touch is an invisible stick: a drag on the
 * left half of the screen walks, a drag on the right half looks. Nothing is drawn.
 */
class InputState {
  private readonly held = new Set<string>();
  private lookDx = 0;
  private lookDy = 0;
  private moveStick: TouchStick | null = null;
  private lookStick: TouchStick | null = null;
  private lastActivity = 0;
  override: InputOverride | null = null;

  /** Time of the last real input, ms (performance clock). */
  get lastActivityMs(): number {
    return this.lastActivity;
  }

  attach(canvas: HTMLCanvasElement): () => void {
    const touched = () => {
      this.lastActivity = performance.now();
    };
    const keydown = (e: KeyboardEvent) => {
      this.held.add(e.code);
      touched();
    };
    const keyup = (e: KeyboardEvent) => {
      this.held.delete(e.code);
    };
    const blur = () => {
      this.held.clear();
      this.moveStick = null;
      this.lookStick = null;
    };
    const click = () => {
      if (document.pointerLockElement !== canvas) void canvas.requestPointerLock();
    };
    const mousemove = (e: MouseEvent) => {
      if (document.pointerLockElement !== canvas) return;
      this.lookDx += e.movementX;
      this.lookDy += e.movementY;
      touched();
    };
    const touchstart = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        const stick: TouchStick = { id: t.identifier, originX: t.clientX, originY: t.clientY, x: t.clientX, y: t.clientY };
        if (t.clientX < window.innerWidth / 2) this.moveStick ??= stick;
        else this.lookStick ??= stick;
      }
      touched();
      e.preventDefault();
    };
    const touchmove = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (this.moveStick?.id === t.identifier) {
          this.moveStick.x = t.clientX;
          this.moveStick.y = t.clientY;
        } else if (this.lookStick?.id === t.identifier) {
          this.lookDx += (t.clientX - this.lookStick.x) * (LOOK.touchDegPerPx / LOOK.mouseDegPerPx);
          this.lookDy += (t.clientY - this.lookStick.y) * (LOOK.touchDegPerPx / LOOK.mouseDegPerPx);
          this.lookStick.x = t.clientX;
          this.lookStick.y = t.clientY;
        }
      }
      touched();
      e.preventDefault();
    };
    const touchend = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        if (this.moveStick?.id === t.identifier) this.moveStick = null;
        if (this.lookStick?.id === t.identifier) this.lookStick = null;
      }
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('blur', blur);
    canvas.addEventListener('click', click);
    window.addEventListener('mousemove', mousemove);
    canvas.addEventListener('touchstart', touchstart, { passive: false });
    canvas.addEventListener('touchmove', touchmove, { passive: false });
    canvas.addEventListener('touchend', touchend);
    canvas.addEventListener('touchcancel', touchend);
    return () => {
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('blur', blur);
      canvas.removeEventListener('click', click);
      window.removeEventListener('mousemove', mousemove);
      canvas.removeEventListener('touchstart', touchstart);
      canvas.removeEventListener('touchmove', touchmove);
      canvas.removeEventListener('touchend', touchend);
      canvas.removeEventListener('touchcancel', touchend);
    };
  }

  /** Reads this frame's intent and clears accumulated look motion. */
  consume(dt: number, lookRateScale: number): InputFrame {
    const h = this.held;
    let moveRight = (any(RIGHT_KEYS, h) ? 1 : 0) - (any(LEFT_KEYS, h) ? 1 : 0);
    let moveForward = (any(FORWARD_KEYS, h) ? 1 : 0) - (any(BACK_KEYS, h) ? 1 : 0);
    if (this.moveStick) {
      const dx = (this.moveStick.x - this.moveStick.originX) / TOUCH.stickRadiusPx;
      const dy = (this.moveStick.y - this.moveStick.originY) / TOUCH.stickRadiusPx;
      const len = Math.hypot(dx, dy);
      if (len > TOUCH.deadZoneRatio) {
        const scale = Math.min(1, len) / len;
        moveRight += dx * scale;
        moveForward -= dy * scale;
      }
    }
    const turn = (any(TURN_LEFT_KEYS, h) ? 1 : 0) - (any(TURN_RIGHT_KEYS, h) ? 1 : 0);
    const tilt = (any(LOOK_UP_KEYS, h) ? 1 : 0) - (any(LOOK_DOWN_KEYS, h) ? 1 : 0);
    const frame: InputFrame = {
      moveRight,
      moveForward,
      lookYawDeg: (-this.lookDx * LOOK.mouseDegPerPx + turn * LOOK.keyTurnDegPerSec * dt) * lookRateScale,
      lookPitchDeg: (-this.lookDy * LOOK.mouseDegPerPx + tilt * LOOK.keyTurnDegPerSec * dt) * lookRateScale,
    };
    this.lookDx = 0;
    this.lookDy = 0;
    return frame;
  }
}

export const input = new InputState();
