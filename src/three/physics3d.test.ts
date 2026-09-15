import { expect, it } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { PHYSICS_3D, approachAngle, flipperYaw } from '../config/physics3d';
import { createComponent } from './components';

it('lets a ball descend between the right hub and the launcher wall', async () => {
  await RAPIER.init(); const { world, rotation, point } = board(PHYSICS_3D.gravity, PHYSICS_3D.tilt);
  const visual = createComponent('flipper', { side: 'right', externalPose: true });
  if (visual.collider.type !== 'convex') throw new Error('Flipper hull required');
  const p = point(2.65, 0.55, 6.37);
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y, p.z).setRotation(rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), flipperYaw(-0.18)))));
  world.createCollider(RAPIER.ColliderDesc.convexHull(visual.collider.vertices)!, body);
  const wp = point(4.05, 0.45, 3.7);
  world.createCollider(RAPIER.ColliderDesc.cuboid(0.12, 0.62, 5.6), world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(wp.x, wp.y, wp.z).setRotation(rotation)));
  const bp = point(3.48, 0.43, 5.6);
  const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(bp.x, bp.y, bp.z).setCcdEnabled(true));
  world.createCollider(RAPIER.ColliderDesc.ball(0.42).setFriction(PHYSICS_3D.ballFriction), ball);
  for (let i = 0; i < 360; i++) world.step();
  expect(new THREE.Vector3().copy(ball.translation()).applyQuaternion(rotation.clone().invert()).z).toBeGreaterThan(9.5);
  visual.dispose(); world.free();
});

function board(gravity: number, tilt: number) {
  const world = new RAPIER.World({ x: 0, y: -gravity, z: 0 }); world.timestep = PHYSICS_3D.timestep;
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), tilt);
  const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(rotation);
  const floor = point(0, -0.25, 0); const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(floor.x, floor.y, floor.z).setRotation(rotation));
  world.createCollider(RAPIER.ColliderDesc.cuboid(20, 0.25, 100).setFriction(0.45), body);
  return { world, rotation, point };
}
it('accelerates naturally down the incline, faster than the previous calibration', async () => {
  await RAPIER.init();
  const measure = (gravity: number, tilt: number) => {
    const { world, rotation, point } = board(gravity, tilt); const p = point(0, 0.43, 0);
    const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setLinearDamping(PHYSICS_3D.linearDamping).setCcdEnabled(true));
    world.createCollider(RAPIER.ColliderDesc.ball(0.42).setFriction(PHYSICS_3D.ballFriction), ball);
    for (let i = 0; i < 120; i++) world.step(); const first = new THREE.Vector3().copy(ball.linvel()).applyQuaternion(rotation.clone().invert()).z;
    for (let i = 0; i < 120; i++) world.step(); const second = new THREE.Vector3().copy(ball.linvel()).applyQuaternion(rotation.clone().invert()).z;
    world.free(); return { first, second };
  };
  const old = measure(9.81, 0.11); const current = measure(PHYSICS_3D.gravity, PHYSICS_3D.tilt);
  expect(current.second).toBeGreaterThan(current.first * 1.6);
  expect(current.second).toBeGreaterThan(old.second * 3);
  expect(current.second).toBeLessThan(PHYSICS_3D.maxBallSpeed);
});

it.each(['left', 'right'] as const)('sends a contacted ball uphill with the %s flipper', async side => {
  await RAPIER.init(); const { world, rotation, point } = board(PHYSICS_3D.gravity, PHYSICS_3D.tilt);
  const sign = side === 'left' ? 1 : -1;
  const visual = createComponent('flipper', { side, externalPose: true });
  if (visual.collider.type !== 'convex') throw new Error('Flipper hull required');
  const pose = (angle: number) => rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), flipperYaw(angle * sign)));
  const fp = point(0, 0.55, 0); const flipper = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(fp.x, fp.y, fp.z).setRotation(pose(0.18)));
  world.createCollider(RAPIER.ColliderDesc.convexHull(visual.collider.vertices)!.setRestitution(0.6), flipper);
  const bp = point(1.45 * sign, 0.65, -0.42); const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(bp.x, bp.y, bp.z).setCcdEnabled(true));
  world.createCollider(RAPIER.ColliderDesc.ball(0.42).setRestitution(PHYSICS_3D.ballRestitution), ball);
  let angle = 0.18; let bestUphillSpeed = 0;
  for (let i = 0; i < 60; i++) {
    angle = approachAngle(angle, -0.62, PHYSICS_3D.flipperAngularSpeed, PHYSICS_3D.timestep);
    flipper.setNextKinematicRotation(pose(angle)); world.step();
    bestUphillSpeed = Math.min(bestUphillSpeed, new THREE.Vector3().copy(ball.linvel()).applyQuaternion(rotation.clone().invert()).z);
  }
  expect(bestUphillSpeed).toBeLessThan(-8);
  visual.dispose(); world.free();
});
