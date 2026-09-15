import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createComponent, defaultParams } from './index';

describe('functional flipper pivot', () => {
  it.each(['left', 'right'] as const)('keeps the %s hub fixed for every angle and proportion', async side => {
    await RAPIER.init();
    for (const width of [0.5, 1, 1.5]) for (const depth of [0.5, 1.5]) {
      const visual = createComponent('flipper', { side, externalPose: true, params: { ...defaultParams('flipper'), width, depth } });
      const hub = visual.root.getObjectByName('flipper-hub')!; const paddle = visual.root.getObjectByName('flipper-body') as THREE.Mesh;
      expect(visual.collider.type).toBe('convex'); if (visual.collider.type !== 'convex') throw new Error('Convex required');
      const world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(3, 1, 6));
      const descriptor = RAPIER.ColliderDesc.convexHull(visual.collider.vertices); expect(descriptor).not.toBeNull();
      const collider = world.createCollider(descriptor!, body);
      let previousTip: THREE.Vector3 | undefined;
      for (const angle of [-0.62, 0, 0.18, 0.62]) {
        const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), angle);
        body.setNextKinematicRotation(rotation); world.step();
        visual.root.position.set(3, 1, 6); visual.root.quaternion.copy(rotation); visual.root.updateMatrixWorld(true);
        expect(hub.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(3, 1, 6))).toBeLessThan(1e-6);
        const vertices = visual.collider.vertices; const local = new THREE.Vector3(vertices[0], vertices[1], vertices[2]);
        const rendered = new THREE.Vector3().fromBufferAttribute(paddle.geometry.getAttribute('position'), 0).applyMatrix4(paddle.matrixWorld);
        const physical = local.applyQuaternion(new THREE.Quaternion().copy(collider.rotation())).add(new THREE.Vector3().copy(collider.translation()));
        expect(rendered.distanceTo(physical)).toBeLessThan(1e-5);
        if (previousTip) expect(rendered.distanceTo(previousTip)).toBeGreaterThan(0);
        previousTip = rendered;
      }
      visual.dispose(); world.free();
    }
  });
});
