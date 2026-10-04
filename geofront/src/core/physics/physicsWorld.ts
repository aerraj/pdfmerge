import type { RigidBody, World } from '@dimforge/rapier3d-compat';
import { PHYSICS } from '../../config/movement';
import type { ZoneId } from '../../contracts/manifest';
import type { ZoneContent } from '../zones/zoneContent';
import type { Rapier } from './rapier';

/**
 * Static collision for every loaded zone (one fixed body per zone, one trimesh per COL_
 * mesh). Gravity is applied by the character controller, so the world itself has none.
 */
export class PhysicsWorld {
  readonly rapier: Rapier;
  readonly world: World;
  private readonly zones = new Map<ZoneId, { body: RigidBody; lowestY: number }>();

  constructor(rapier: Rapier) {
    this.rapier = rapier;
    this.world = new rapier.World({ x: 0, y: 0, z: 0 });
    this.world.timestep = PHYSICS.fixedStepSec;
  }

  addZone(zone: ZoneContent): void {
    if (this.zones.has(zone.id)) return;
    const body = this.world.createRigidBody(this.rapier.RigidBodyDesc.fixed());
    let lowestY = Infinity;
    for (const c of zone.colliders) {
      // Merged vertices and fixed internal edges stop the capsule snagging on the seams
      // between collision pieces (FIX_INTERNAL_EDGES implies MERGE_DUPLICATE_VERTICES).
      this.world.createCollider(this.rapier.ColliderDesc.trimesh(c.positions, c.indices, this.rapier.TriMeshFlags.FIX_INTERNAL_EDGES), body);
      for (let i = 1; i < c.positions.length; i += 3) lowestY = Math.min(lowestY, c.positions[i] ?? Infinity);
    }
    this.zones.set(zone.id, { body, lowestY });
  }

  removeZone(id: ZoneId): void {
    const z = this.zones.get(id);
    if (!z) return;
    this.world.removeRigidBody(z.body);
    this.zones.delete(id);
  }

  has(id: ZoneId): boolean {
    return this.zones.has(id);
  }

  /** Lowest collision point across every loaded zone, m; the fall safety net is below it. */
  lowestY(): number | null {
    let lowest: number | null = null;
    for (const z of this.zones.values()) lowest = Math.min(lowest ?? Infinity, z.lowestY);
    return lowest;
  }

  step(): void {
    this.world.step();
  }

  dispose(): void {
    this.world.free();
    this.zones.clear();
  }
}
