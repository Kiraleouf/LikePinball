import { beforeAll, expect, it } from 'vitest';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { createComponent, defaultParams } from './components';
import { PHYSICS_3D } from '../config/physics3d';
import { TubeCurve } from './components/tube';
import { parseTemplate, serializeTemplate } from '../editor/template';
import { tubeWorldPath, withTubePoints } from '../tables/tubePath';
import { readTemplateCatalogue } from '../tables/templateCatalogue';
import type { TubeDefinition } from '../tables/types';

const path = [{ x: -2, y: 0, z: -6 }, { x: -1.5, y: 0.8, z: -2 }, { x: 1.5, y: 1.4, z: 1 }, { x: 1, y: 0.7, z: 4 }, { x: 0, y: 0, z: 7 }];
beforeAll(async () => { await RAPIER.init(); });

it('interpolates each height without undershooting the board, with level open mouths', () => {
  const curve = new TubeCurve(path, 0.75);
  path.forEach((p, i) => expect(curve.getPoint(i / (path.length - 1)).y).toBeCloseTo(p.y + 0.75));
  for (let i = 0; i <= 200; i++) expect(curve.getPoint(i / 200).y).toBeGreaterThanOrEqual(0.75);
  expect(Math.abs(curve.getTangent(0).y)).toBeLessThan(0.001); expect(Math.abs(curve.getTangent(1).y)).toBeLessThan(0.001);
});

it('shares the exact shell vertices/triangles with physics and keeps control rings on the curve', () => {
  const tube = createComponent('tube', { path });
  try {
    const shell = tube.root.getObjectByName('tube-shell') as THREE.Mesh;
    if (tube.collider.type !== 'trimesh') throw new Error('Missing hollow collider');
    expect(shell.geometry.getAttribute('position').array).toEqual(tube.collider.vertices);
    expect(Array.from(shell.geometry.getIndex()!.array)).toEqual(Array.from(tube.collider.indices));
    path.forEach((_, i) => expect(tube.root.getObjectByName(`tube-control-${i}`)!.position.distanceTo(tube.tube!.curve.getPoint(i / (path.length - 1)))).toBeLessThan(1e-8));
    const material = shell.material as THREE.MeshPhysicalMaterial;
    expect(material.transparent).toBe(true); expect(material.opacity).toBeLessThan(0.5); expect(material.depthWrite).toBe(false);
    const hidden = createComponent('tube', { path, params: { ...defaultParams('tube'), tubeRings: 0 } });
    expect(hidden.root.getObjectByName('tube-control-0')!.visible).toBe(false); hidden.dispose();
  } finally { tube.dispose(); }
});

it.each([14, 18, 24])('enters from the board, follows multiple curves/heights and exits at %s u/s', speed => {
  const tube = createComponent('tube', { path });
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), PHYSICS_3D.tilt);
  const inverse = rotation.clone().invert();
  const world = new RAPIER.World({ x: 0, y: -PHYSICS_3D.gravity, z: 0 }); world.timestep = PHYSICS_3D.timestep;
  try {
    if (tube.collider.type !== 'trimesh') throw new Error('Missing mesh');
    const board = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setRotation(rotation));
    world.createCollider(RAPIER.ColliderDesc.cuboid(10, 0.25, 20).setTranslation(0, -0.25, 0).setFriction(PHYSICS_3D.ballFriction), board);
    world.createCollider(RAPIER.ColliderDesc.trimesh(tube.collider.vertices, tube.collider.indices, RAPIER.TriMeshFlags.FIX_INTERNAL_EDGES).setFriction(PHYSICS_3D.tubeFriction).setRestitution(PHYSICS_3D.tubeRestitution), board);
    const curve = tube.tube!.curve; const start = curve.getPoint(0).addScaledVector(curve.getTangent(0), -1.4); start.y = 0.435; start.applyQuaternion(rotation);
    const ball = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic().setTranslation(start.x, start.y, start.z).setCcdEnabled(true).setLinearDamping(PHYSICS_3D.linearDamping));
    world.createCollider(RAPIER.ColliderDesc.ball(0.42).setRestitution(PHYSICS_3D.ballRestitution).setFriction(PHYSICS_3D.ballFriction).setDensity(1.2), ball);
    ball.setLinvel(curve.getTangent(0).multiplyScalar(speed).applyQuaternion(rotation), true);
    const samples = Array.from({ length: 401 }, (_, i) => curve.getPoint(i / 400));
    const end = curve.getPoint(1); const tangent = curve.getTangent(1); let highest = 0; let entered = false; let exited = false; let landed = false;
    for (let step = 0; step < 1200; step++) {
      world.step(); const position = new THREE.Vector3().copy(ball.translation()).applyQuaternion(inverse);
      highest = Math.max(highest, position.y - 0.42);
      let nearest = 0; let distance = Infinity;
      samples.forEach((sample, i) => { const d = sample.distanceTo(position); if (d < distance) { nearest = i; distance = d; } });
      if (nearest > 12 && nearest < 385) { entered = true; expect(distance, `escaped at step ${step}, sample ${nearest}`).toBeLessThan(tube.tube!.radius - 0.42 + 0.10); }
      if (entered && position.clone().sub(end).dot(tangent) > 1) exited = true;
      if (exited && position.y < 0.6) { landed = true; break; }
      expect(Number.isFinite(position.y)).toBe(true);
    }
    expect(entered).toBe(true); expect(highest).toBeGreaterThan(1); expect(exited).toBe(true); expect(landed).toBe(true);
  } finally { world.free(); tube.dispose(); }
});

it('persists ordered points, explicit ends and settings, constraining edited endpoints to zero', () => {
  const tube: TubeDefinition = { type: 'tube', id: 'tube-test', entry: 0, exit: 4, params: { ...defaultParams('tube'), tubeDiameter: 1.8, tubeRingThickness: 0.05 }, points: path.map(p => ({ x: p.x * 45 + 360, y: p.z * 50 + 540, z: p.y })) };
  expect(tubeWorldPath(tube.points)).toEqual(path);
  const initial = readTemplateCatalogue().find(t => t.metadata.sectorIndex === 0)!;
  const file = parseTemplate(serializeTemplate({ ...initial.sector, tubes: [tube] }, initial.metadata)); expect(file.sector.tubes).toEqual([tube]);
  const shortened = withTubePoints(tube, tube.points.slice(1)); expect(shortened.points[0].z).toBe(0); expect(shortened.exit).toBe(3);
  expect(() => parseTemplate(serializeTemplate({ ...initial.sector, tubes: [{ ...tube, points: tube.points.map(p => ({ ...p, z: 1 })) }] }))).toThrow();
  expect(() => withTubePoints(tube, [tube.points[0], tube.points[0]])).toThrow();
});
