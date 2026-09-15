import type RAPIER from '@dimforge/rapier3d-compat';
import { Vector3 } from 'three';
import { PHYSICS_3D } from '../config/physics3d';
import type { ActiveFace } from './components';

/** One strike per contact, including contacts that move from a passive face to the band. */
export class SlingshotContact {
  private struck = false;
  private nextHitAt = 0;

  public update(world: RAPIER.World, slingshot: RAPIER.Collider, ball: RAPIER.Collider, face: ActiveFace, time: number): boolean {
    let touching = false; let active = false;
    world.contactPair(slingshot, ball, (manifold, flipped) => {
      const normal = flipped ? manifold.localNormal2() : manifold.localNormal1();
      const alignment = Math.abs(face.normal.dot(normal));
      for (let i = 0; i < manifold.numContacts(); i++) {
        if (manifold.contactDist(i) > PHYSICS_3D.slingshotContactTolerance) continue;
        touching = true;
        const point = flipped ? manifold.localContactPoint2(i) : manifold.localContactPoint1(i);
        if (!point || alignment < PHYSICS_3D.slingshotFaceAlignment) continue;
        const offset = new Vector3().copy(point).sub(face.start);
        const edge = face.end.clone().sub(face.start);
        const along = offset.dot(edge) / edge.lengthSq();
        if (Math.abs(offset.dot(face.normal)) <= PHYSICS_3D.slingshotContactTolerance && along >= 0 && along <= 1) active = true;
      }
    });
    if (!touching) this.struck = false;
    if (!active || this.struck || time < this.nextHitAt) return false;
    this.struck = true; this.nextHitAt = time + PHYSICS_3D.slingshotCooldown;
    return true;
  }
}
