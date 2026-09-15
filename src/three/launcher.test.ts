import { expect, it } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { LAUNCHER, hasExitedLauncher, launcherStructure, rightBoundary } from './machine';
import { PHYSICS_3D } from '../config/physics3d';

it.each([0, 0.5, 1])('physically traverses the external lane with charge %s and prevents return', async charge => {
  await RAPIER.init();
  const world = new RAPIER.World({ x: 0, y: -PHYSICS_3D.gravity, z: 0 }); world.timestep = PHYSICS_3D.timestep;
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), PHYSICS_3D.tilt);
  const point = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z).applyQuaternion(rotation);
  const local = (p: RAPIER.Vector) => new THREE.Vector3().copy(p).applyQuaternion(rotation.clone().invert());
  const box = (x: number, y: number, z: number, width: number, height: number, depth: number, yaw = 0) => {
    const p = point(x, y, z); const pose = rotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    world.createCollider(RAPIER.ColliderDesc.cuboid(width / 2, height / 2, depth / 2).setRestitution(0.45), world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(p.x, p.y, p.z).setRotation(pose)));
  };
  box(0, -0.25, 0, 12, 0.5, 20); const right = rightBoundary(0); box(5.75, 0.42, right.z, 0.36, 1.3, right.length);
  box(0, 0.42, -10, 11.1, 1.1, 0.4);
  launcherStructure().forEach(b => box(b.x, b.y, b.z, b.width, b.height, b.depth, b.yaw));
  const p = point(LAUNCHER.x, 0.43, LAUNCHER.spawnZ);
  const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(p.x, p.y, p.z).setCcdEnabled(true).setLinearDamping(PHYSICS_3D.linearDamping));
  world.createCollider(RAPIER.ColliderDesc.ball(0.42).setRestitution(PHYSICS_3D.ballRestitution).setFriction(PHYSICS_3D.ballFriction), ball);
  ball.setLinvel(point(0, 0, -PHYSICS_3D.launchMinSpeed - charge * PHYSICS_3D.launchExtraSpeed), true);
  let exited = false; let traversedLane = false;
  for (let i = 0; i < 1200; i++) {
    world.step(); const p = local(ball.translation());
    if (p.x > 6 && p.z < 0) traversedLane = true;
    if (hasExitedLauncher(p.x, p.z)) { exited = true; break; }
  }
  expect(traversedLane).toBe(true); expect(exited).toBe(true);
  box(LAUNCHER.gateX, 0.6, LAUNCHER.gateZ, LAUNCHER.gateLength, 1.5, 0.3, Math.PI / 2);
  ball.setTranslation(point(4.8, 0.43, LAUNCHER.gateZ), true); ball.setLinvel(point(14, 0, 0), true);
  let maxX = 0;
  for (let i = 0; i < 120; i++) { world.step(); maxX = Math.max(maxX, local(ball.translation()).x); }
  expect(maxX).toBeLessThan(5.75);
  world.free();
});
