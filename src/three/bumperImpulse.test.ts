import { expect, it } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { bumperImpulse } from './bumperImpulse';
import { PHYSICS_3D } from '../config/physics3d';

it('preserves tangential momentum, scales by mass and adds no lift on an inclined board', () => {
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), PHYSICS_3D.tilt);
  const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(rotation);
  const center = new THREE.Vector3(); const position = new THREE.Vector3(0, 0.4, 1).applyQuaternion(rotation);
  const velocity = new THREE.Vector3(4, 0, 2).applyQuaternion(rotation);
  const impulse = new THREE.Vector3().copy(bumperImpulse(position, center, velocity, normal, 2));
  expect(impulse.dot(normal)).toBeCloseTo(0);
  const after = velocity.addScaledVector(impulse, 0.5).applyQuaternion(rotation.clone().invert());
  expect(after.x).toBeCloseTo(4); expect(after.z).toBeCloseTo(11);
  const limited = bumperImpulse({ x: 1, y: 0, z: 0 }, center, { x: 33, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, 1);
  expect(33 + limited.x).toBeCloseTo(PHYSICS_3D.maxBallSpeed);
  expect(bumperImpulse(center, center, velocity, normal, 2)).toEqual({ x: 0, y: 0, z: 0 });
});

it.each([1, 8, 22])('actively propels a ball arriving at %s u/s, beyond a passive rebound', async speed => {
  await RAPIER.init();
  const measure = (active: boolean): number => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 }); world.timestep = PHYSICS_3D.timestep;
    const events = new RAPIER.EventQueue(true);
    world.createCollider(RAPIER.ColliderDesc.cylinder(0.6, 1).setRestitution(PHYSICS_3D.bumperRestitution), world.createRigidBody(RAPIER.RigidBodyDesc.fixed()));
    const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(-1.6, 0, 0).setCcdEnabled(true));
    world.createCollider(RAPIER.ColliderDesc.ball(0.42).setRestitution(PHYSICS_3D.ballRestitution).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), ball);
    ball.setLinvel({ x: speed, y: 0, z: 0 }, true);
    let hit = false; let output = 0;
    for (let i = 0; i < 120 && !hit; i++) {
      world.step(events);
      events.drainCollisionEvents((_a, _b, started) => {
        if (!started) return; hit = true;
        if (active) ball.applyImpulse(bumperImpulse(ball.translation(), { x: 0, y: 0, z: 0 }, ball.linvel(), { x: 0, y: 1, z: 0 }, ball.mass()), true);
        output = -ball.linvel().x;
        expect(ball.translation().x).toBeLessThan(-1.3); // Contact does not teleport the ball.
        expect(Math.abs(ball.linvel().y) + Math.abs(ball.linvel().z)).toBeLessThan(0.001);
      });
    }
    expect(hit).toBe(true); events.free(); world.free(); return output;
  };
  const passive = measure(false); const active = measure(true);
  expect(active).toBeGreaterThan(passive + 8);
  expect(active).toBeLessThanOrEqual(PHYSICS_3D.maxBallSpeed);
});

it('stays finite and speed-limited through many successive physical impacts', async () => {
  await RAPIER.init(); const world = new RAPIER.World({ x: 0, y: 0, z: 0 }); world.timestep = PHYSICS_3D.timestep;
  const events = new RAPIER.EventQueue(true); const centers = new Map<number, { x: number; y: number; z: number }>();
  for (const x of [-3, 3]) {
    const center = { x, y: 0, z: 0 };
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(x, 0, 0));
    const collider = world.createCollider(RAPIER.ColliderDesc.cylinder(0.6, 1).setRestitution(PHYSICS_3D.bumperRestitution), body); centers.set(collider.handle, center);
  }
  const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true));
  const collider = world.createCollider(RAPIER.ColliderDesc.ball(0.42).setRestitution(PHYSICS_3D.ballRestitution).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), ball);
  ball.setLinvel({ x: 12, y: 0, z: 0 }, true); let hits = 0;
  for (let i = 0; i < 2400; i++) {
    world.step(events); events.drainCollisionEvents((a, b, started) => {
      if (!started) return; const center = centers.get(a === collider.handle ? b : a); if (!center) return;
      ball.applyImpulse(bumperImpulse(ball.translation(), center, ball.linvel(), { x: 0, y: 1, z: 0 }, ball.mass()), true); hits++;
    });
    const v = ball.linvel(); expect(Math.hypot(v.x, v.y, v.z)).toBeLessThanOrEqual(PHYSICS_3D.maxBallSpeed + 0.001);
    expect(Number.isFinite(ball.translation().x)).toBe(true);
  }
  expect(hits).toBeGreaterThan(40); events.free(); world.free();
});
