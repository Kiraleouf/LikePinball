import { beforeAll, describe, expect, it } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createComponent, defaultParams } from './components';
import { SlingshotContact } from './slingshotContact';
import { directionalImpulse } from './bumperImpulse';
import { PHYSICS_3D } from '../config/physics3d';
import { parseTemplate, serializeTemplate } from '../editor/template';
import { generateSector } from '../tables';
import { readTemplateCatalogue } from '../tables/templateCatalogue';

beforeAll(async () => { await RAPIER.init(); });

function fixture(faceAngle = 0, yaw = 0, width = 1, depth = 1) {
  const visual = createComponent('slingshot', { params: { ...defaultParams('slingshot'), faceAngle, width, depth } });
  if (visual.collider.type !== 'convex' || !visual.activeFace) throw new Error('Expected shared triangular collider and face');
  const world = new RAPIER.World({ x: 0, y: 0, z: 0 }); world.timestep = PHYSICS_3D.timestep;
  const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(PHYSICS_3D.tilt, yaw, 0));
  const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setRotation(rotation));
  const collider = world.createCollider(RAPIER.ColliderDesc.convexHull(visual.collider.vertices)!.setRestitution(PHYSICS_3D.slingshotRestitution), body);
  const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true));
  const ballCollider = world.createCollider(RAPIER.ColliderDesc.ball(0.42).setRestitution(PHYSICS_3D.ballRestitution), ball);
  return { visual, world, rotation, collider, ball, ballCollider, face: visual.activeFace, contact: new SlingshotContact(), dispose() { world.free(); visual.dispose(); } };
}

describe('shared slingshot geometry and physical activation', () => {
  it.each([0, 0.9, -2.4])('keeps the visible elastic face aligned with its collision face at %s radians', faceAngle => {
    const visual = createComponent('slingshot', { params: { ...defaultParams('slingshot'), faceAngle, width: 1.5, depth: 0.5 } });
    try {
      const face = visual.activeFace!;
      const band = visual.root.getObjectByName('elastic-band')!;
      visual.root.updateMatrixWorld(true);
      const strip = band.children[1]; const position = strip.getWorldPosition(new THREE.Vector3());
      expect(Math.abs(position.clone().sub(face.start).dot(face.normal))).toBeCloseTo(visual.size.z * 0.0075);
      expect(Math.abs(strip.getWorldDirection(new THREE.Vector3()).dot(face.normal))).toBeCloseTo(1);
      expect(face.start.distanceTo(face.end)).toBeCloseTo(visual.size.x);
      expect(visual.root.getObjectByName('slingshot-assembly')!.children.filter(c => c.name === 'mechanical-post')).toHaveLength(3);
    } finally { visual.dispose(); }
  });
  it.each([1, 8, 22])('kicks at %s u/s on a rotated and resized active face, beyond a passive rebound', speed => {
    const measure = (enabled: boolean): number => {
      const f = fixture(0.65, -1.1, 1.4, 0.7);
      try {
        const normal = f.face.normal.clone().applyQuaternion(f.rotation);
        const center = f.face.start.clone().add(f.face.end).multiplyScalar(0.5).applyQuaternion(f.rotation);
        f.ball.setTranslation(center.addScaledVector(normal, 0.8), true); f.ball.setLinvel(normal.clone().multiplyScalar(-speed), true);
        let hits = 0; let output = 0;
        for (let i = 0; i < 180; i++) {
          f.world.step();
          if (f.contact.update(f.world, f.collider, f.ballCollider, f.face, i * PHYSICS_3D.timestep)) {
            hits++;
            if (enabled) f.ball.applyImpulse(directionalImpulse(normal, f.ball.linvel(), f.ball.mass(), PHYSICS_3D.slingshotKickSpeed), true);
            output = normal.dot(f.ball.linvel());
          }
        }
        expect(hits).toBe(1); return output;
      } finally { f.dispose(); }
    };
    expect(measure(true)).toBeGreaterThan(measure(false) + 10);
  });

  it.each(['left', 'right', 'top'] as const)('keeps the %s face passive', side => {
    const f = fixture();
    try {
      const w = f.visual.size.x; const d = f.visual.size.z;
      const normal = side === 'top' ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(side === 'left' ? -d : d, 0, w / 2).normalize();
      const point = side === 'top' ? new THREE.Vector3(0, f.visual.size.y / 2, 0) : new THREE.Vector3(side === 'left' ? -w / 4 : w / 4, 0, 0);
      normal.applyQuaternion(f.rotation); point.applyQuaternion(f.rotation);
      f.ball.setTranslation(point.addScaledVector(normal, 0.8), true); f.ball.setLinvel(normal.clone().multiplyScalar(-8), true);
      let touched = false;
      for (let i = 0; i < 120; i++) {
        f.world.step(); f.world.contactPair(f.collider, f.ballCollider, m => { if (m.numSolverContacts()) touched = true; });
        expect(f.contact.update(f.world, f.collider, f.ballCollider, f.face, i * PHYSICS_3D.timestep)).toBe(false);
      }
      expect(touched).toBe(true);
    } finally { f.dispose(); }
  });

  it('strikes only once during prolonged contact and rearms after actual separation', () => {
    const f = fixture();
    try {
      const normal = f.face.normal.clone().applyQuaternion(f.rotation);
      const center = f.face.start.clone().add(f.face.end).multiplyScalar(0.5).applyQuaternion(f.rotation);
      f.world.gravity = normal.clone().multiplyScalar(-20);
      f.collider.setRestitution(0); f.ballCollider.setRestitution(0);
      f.ball.setTranslation(center.clone().addScaledVector(normal, 0.43), true);
      let hits = 0;
      for (let i = 0; i < 240; i++) { f.world.step(); if (f.contact.update(f.world, f.collider, f.ballCollider, f.face, i / 120)) hits++; }
      expect(hits).toBe(1);
      f.ball.setTranslation(center.clone().addScaledVector(normal, 1), true); f.ball.setLinvel({ x: 0, y: 0, z: 0 }, true);
      for (let i = 240; i < 480; i++) { f.world.step(); if (f.contact.update(f.world, f.collider, f.ballCollider, f.face, i / 120)) hits++; }
      expect(hits).toBe(2);
    } finally { f.dispose(); }
  });

  it('keeps successive impulses stable, speed limited and in the board plane', () => {
    const world = new RAPIER.World({ x: 0, y: 0, z: 0 }); world.timestep = PHYSICS_3D.timestep;
    const visuals = [createComponent('slingshot'), createComponent('slingshot')];
    try {
      const slings = visuals.map((visual, i) => {
        if (visual.collider.type !== 'convex' || !visual.activeFace) throw new Error('Missing convex collider');
        const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), i * Math.PI);
        const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(0, 0, i ? -2 : 2).setRotation(rotation));
        const collider = world.createCollider(RAPIER.ColliderDesc.convexHull(visual.collider.vertices)!.setRestitution(PHYSICS_3D.slingshotRestitution), body);
        return { collider, face: visual.activeFace, normal: visual.activeFace.normal.clone().applyQuaternion(rotation), contact: new SlingshotContact() };
      });
      // Constrain only height, like a board, so numerical drift cannot end this repeated-impact stress test.
      const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setCcdEnabled(true).enabledTranslations(true, false, true));
      const ballCollider = world.createCollider(RAPIER.ColliderDesc.ball(0.42).setRestitution(PHYSICS_3D.ballRestitution), ball);
      ball.setLinvel({ x: 0, y: 0, z: 12 }, true); let hits = 0;
      for (let i = 0; i < 2400; i++) {
        world.step();
        for (const sling of slings) if (sling.contact.update(world, sling.collider, ballCollider, sling.face, i / 120)) {
          ball.applyImpulse(directionalImpulse(sling.normal, ball.linvel(), ball.mass(), PHYSICS_3D.slingshotKickSpeed), true); hits++;
        }
        const v = ball.linvel(); expect(Math.hypot(v.x, v.y, v.z)).toBeLessThanOrEqual(PHYSICS_3D.maxBallSpeed + 0.001);
        expect(Math.abs(v.y)).toBeLessThan(0.001); expect(Number.isFinite(ball.translation().z)).toBe(true);
      }
      expect(hits).toBeGreaterThan(30);
    } finally { world.free(); visuals.forEach(visual => visual.dispose()); }
  });

  it('compresses the shared band, flashes and restores Idle without moving its collider', () => {
    const visual = createComponent('slingshot'); const band = visual.root.getObjectByName('elastic-band')!;
    const collider = structuredClone(visual.collider);
    visual.setState('Hit'); visual.update(0.05); expect(band.position.z).toBeGreaterThan(0);
    const strip = band.children[1] as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>;
    expect(strip.material.emissiveIntensity).toBeGreaterThan(defaultParams('slingshot').emissiveIntensity);
    visual.update(0.4); expect(band.position.z).toBe(0); expect(visual.collider).toEqual(collider);
    visual.setState('Activate'); visual.update(1); expect(band.position.z).toBeGreaterThan(0);
    visual.setState('Idle'); visual.update(0.1); expect(band.position.z).toBe(0); visual.dispose();
  });
});

it('round trips editable slingshot poses and keeps legacy templates compatible', () => {
  const catalogue = readTemplateCatalogue(); const initial = catalogue.find(t => t.metadata.sectorIndex === 0)!;
  const changed = { ...initial.sector, slingshots: [{ id: 'edited', x: 250, y: 710, angle: 1.234 }] };
  const saved = parseTemplate(serializeTemplate(changed, initial.metadata));
  expect(generateSector('seed', 0, [saved]).slingshots).toEqual(changed.slingshots);
  const legacy = { ...initial.sector, slingshots: undefined };
  expect(parseTemplate(serializeTemplate(legacy)).sector.slingshots).toBeUndefined();
  expect(() => parseTemplate(serializeTemplate({ ...changed, slingshots: [{ ...changed.slingshots[0], angle: NaN }] }))).toThrow();
});
