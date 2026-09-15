import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { PHYSICS_3D, flipperYaw, approachAngle } from '../../config/physics3d';
import { resolveParams, type ComponentKind, type VisualParams } from './presets';
import { createTube } from './tube';
export * from './presets';

export type VisualState = 'Idle' | 'Hit' | 'Activate';
export interface Size { x: number; y: number; z: number }
/** Resting collision face, in component-local coordinates. */
export interface ActiveFace { start: THREE.Vector3; end: THREE.Vector3; normal: THREE.Vector3 }
export type CollisionShape = { type: 'box'; half: Size } | { type: 'ball'; radius: number } | { type: 'cylinder'; radius: number; halfHeight: number } | { type: 'convex'; vertices: Float32Array } | { type: 'trimesh'; vertices: Float32Array; indices: Uint32Array };
export interface ComponentOptions { params?: VisualParams; size?: Size; color?: number; side?: 'left' | 'right'; externalPose?: boolean; path?: readonly Size[] }
export const baseSizes: Record<ComponentKind, Size> = {
  flipper: { x: 2.5, y: 0.48, z: 0.6 }, bumper: { x: 2, y: 1.2, z: 2 },
  post: { x: 0.4, y: 0.9, z: 0.4 }, ball: { x: 0.84, y: 0.84, z: 0.84 },
  rail: { x: 4, y: 0.64, z: 0.24 }, wall: { x: 3.3, y: 0.72, z: 0.6 },
  launcher: { x: 0.85, y: 0.72, z: 1.8 }, gate: { x: 1.5, y: 1, z: 0.36 },
  slingshot: { x: 2.2, y: 0.72, z: 1.7 },
  tube: { x: 6, y: 3, z: 6 },
};
export const states: Record<ComponentKind, readonly VisualState[]> = {
  flipper: ['Idle', 'Hit', 'Activate'], bumper: ['Idle', 'Hit'], post: ['Idle'], ball: ['Idle', 'Hit'],
  rail: ['Idle', 'Hit'], wall: ['Idle', 'Hit'], launcher: ['Idle', 'Hit', 'Activate'], gate: ['Idle', 'Activate'],
  slingshot: ['Idle', 'Hit', 'Activate'],
  tube: ['Idle'],
};
export function dimensions(kind: ComponentKind, params: VisualParams, size = baseSizes[kind]): Size {
  // Round bodies use one radial scale so their collider stays exactly round.
  if (kind === 'ball') return { x: size.x * params.width, y: size.y * params.width, z: size.z * params.width };
  return { x: size.x * params.width, y: size.y * params.height, z: size.z * (kind === 'bumper' || kind === 'post' ? params.width : params.depth) };
}
export function collisionShape(kind: ComponentKind, size: Size): CollisionShape {
  if (kind === 'ball') return { type: 'ball', radius: size.x / 2 };
  if (kind === 'bumper' || kind === 'post') return { type: 'cylinder', radius: size.x / 2, halfHeight: size.y / 2 };
  return { type: 'box', half: { x: size.x / 2, y: size.y / 2, z: size.z / 2 } };
}
export interface Component3D {
  root: THREE.Group; size: Size; collider: CollisionShape; activeFace?: ActiveFace;
  tube?: { curve: THREE.Curve<THREE.Vector3>; radius: number };
  setState(state: VisualState): void; setAmount(amount: number): void; update(delta: number): void; dispose(): void;
}
export function createComponent(kind: ComponentKind, options: ComponentOptions = {}): Component3D {
  if (kind === 'tube') return createTube(options.params ?? resolveParams(kind), options.path);
  const p = options.params ?? resolveParams(kind); const size = dimensions(kind, p, options.size);
  const { x: w, y: h, z: d } = size;
  const root = new THREE.Group(); root.name = kind; root.userData.componentKind = kind;
  const metal = new THREE.MeshStandardMaterial({ color: p.color, metalness: p.metalness, roughness: p.roughness });
  const trim = new THREE.MeshStandardMaterial({ color: '#8a9da9', metalness: p.metalness, roughness: p.roughness });
  const rubber = new THREE.MeshStandardMaterial({ color: '#080c11', metalness: 0.05, roughness: 0.7 });
  const neon = new THREE.MeshStandardMaterial({ color: options.color ?? p.neon, emissive: options.color ?? p.neon, emissiveIntensity: p.emissiveIntensity, metalness: 0, roughness: 0.5, toneMapped: false });
  const animated = new THREE.Group(); root.add(animated);
  let ballMaterial: THREE.MeshPhysicalMaterial | undefined;
  let collider = collisionShape(kind, size);
  let activeFace: ActiveFace | undefined;
  function mesh(g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0, parent: THREE.Object3D = root): THREE.Mesh {
    const object = new THREE.Mesh(g, m); object.position.set(x, y, z); object.castShadow = true; object.receiveShadow = true; parent.add(object); return object;
  }
  function box(x: number, y: number, z: number, material: THREE.Material, px = 0, py = 0, pz = 0, parent: THREE.Object3D = root): THREE.Mesh {
    return mesh(new RoundedBoxGeometry(x, y, z, 3, Math.min(p.bevel, x / 4, y / 4, z / 4)), material, px, py, pz, parent);
  }
  function cylinder(r1: number, r2: number, height: number, material: THREE.Material, y = 0, parent: THREE.Object3D = root): THREE.Mesh {
    return mesh(new THREE.CylinderGeometry(r1, r2, height, 40), material, 0, y, 0, parent);
  }
  function ring(radius: number, thickness: number, y: number, material: THREE.Material, parent: THREE.Object3D = root): void {
    const torus = mesh(new THREE.TorusGeometry(radius, thickness, 10, 48), material, 0, y, 0, parent); torus.rotation.x = Math.PI / 2;
  }
  if (kind === 'bumper') {
    cylinder(w * 0.49, w * 0.5, h * 0.2, rubber, -h * 0.38);
    cylinder(w * 0.39, w * 0.47, h * 0.64, metal, -h * 0.02);
    ring(w * 0.45, h * 0.045, h * 0.15, neon);
    cylinder(w * 0.36, w * 0.42, h * 0.16, trim, h * 0.34, animated);
    cylinder(w * 0.32, w * 0.35, h * 0.1, metal, h * 0.46, animated);
    ring(w * 0.24, h * 0.022, h * 0.52, neon, animated);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; const screw = mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.025, 6), trim, Math.cos(a) * w * 0.3, h * 0.53, Math.sin(a) * w * 0.3, animated); screw.name = 'cap-fastener'; }
  } else if (kind === 'flipper') {
    const shape = new THREE.Shape(); const left = -w / 2; const right = w / 2; const tip = d * p.taper / 2;
    shape.moveTo(left + d / 2, -d / 2); shape.lineTo(right - tip, -tip);
    shape.quadraticCurveTo(right, -tip, right, 0); shape.quadraticCurveTo(right, tip, right - tip, tip);
    shape.lineTo(left + d / 2, d / 2); shape.quadraticCurveTo(left, d / 2, left, 0); shape.quadraticCurveTo(left, -d / 2, left + d / 2, -d / 2);
    const g = new THREE.ExtrudeGeometry(shape, { depth: h * 0.65, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: Math.min(p.bevel, h * 0.12), bevelThickness: h * 0.1, curveSegments: 20 });
    g.rotateX(-Math.PI / 2); g.translate(0, -h * 0.33, 0);
    const paddle = mesh(g, metal); paddle.name = 'flipper-body'; const band = mesh(g.clone(), neon); band.scale.set(1.005, 0.12, 1.005);
    const hub = cylinder(d * 0.37, d * 0.43, h * 0.9, trim); hub.position.x = left + d / 2; hub.name = 'flipper-hub';
    const cap = cylinder(d * 0.2, d * 0.2, h * 0.08, rubber, h * 0.48); cap.position.x = left + d / 2;
    box(w * 0.42, h * 0.05, d * 0.2, trim, w * 0.06, h * 0.44);
    const assembly = new THREE.Group();
    for (const child of [...root.children]) assembly.add(child);
    assembly.position.x = w / 2 - d / 2;
    root.add(assembly);
    if (options.side === 'right') { const mirrored = new THREE.Group(); mirrored.add(assembly); mirrored.rotation.y = Math.PI; root.add(mirrored); }
    root.updateMatrixWorld(true);
    const positions = g.getAttribute('position'); const vertices = new Float32Array(positions.count * 3);
    const point = new THREE.Vector3();
    for (let i = 0; i < positions.count; i++) { point.fromBufferAttribute(positions, i).applyMatrix4(paddle.matrixWorld); point.toArray(vertices, i * 3); }
    collider = { type: 'convex', vertices };
  } else if (kind === 'slingshot') {
    const assembly = new THREE.Group(); assembly.name = 'slingshot-assembly';
    root.add(assembly); assembly.add(animated); animated.name = 'elastic-band';
    assembly.rotation.y = -p.faceAngle;
    const corners = [new THREE.Vector3(-w / 2, 0, -d / 2), new THREE.Vector3(w / 2, 0, -d / 2), new THREE.Vector3(0, 0, d / 2)];
    const bevel = Math.min(p.bevel, h * 0.09);
    // The beveled plates sit inside a single triangular collision envelope.
    const plate = (scale: number, height: number, y: number, material: THREE.Material): void => {
      const shape = new THREE.Shape();
      corners.forEach((v, i) => i ? shape.lineTo(v.x * scale, -v.z * scale) : shape.moveTo(v.x * scale, -v.z * scale)); shape.closePath();
      const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: bevel, bevelThickness: bevel });
      geometry.rotateX(-Math.PI / 2); mesh(geometry, material, 0, y, 0, assembly);
    };
    plate(0.91, h * 0.15, -h * 0.43, trim);
    plate(0.84, h * 0.49, -h * 0.26, metal);
    plate(0.70, h * 0.055, h * 0.27, rubber);
    for (const corner of corners) {
      const post = new THREE.Group(); post.name = 'mechanical-post'; post.position.copy(corner).multiplyScalar(0.73); assembly.add(post);
      const r = Math.min(w, d) * 0.07;
      cylinder(r, r * 1.2, h * 0.73, trim, 0, post);
      cylinder(r * 0.72, r * 0.72, h * 0.06, rubber, h * 0.40, post);
      ring(r, r * 0.14, h * 0.37, neon, post);
      const screw = mesh(new THREE.CylinderGeometry(r * 0.37, r * 0.37, h * 0.035, 6), trim, 0, h * 0.45, 0, post); screw.name = 'post-fastener';
    }
    box(w * 0.96, h * 0.36, d * 0.12, rubber, 0, h * 0.16, -d * 0.44, animated);
    box(w * 0.82, h * 0.07, d * 0.025, neon, 0, h * 0.25, -d * 0.495, animated);
    box(w * 0.82, h * 0.025, d * 0.04, neon, 0, h * 0.36, -d * 0.44, animated);
    // A short actuator and its guide remain visible behind the elastic face.
    box(w * 0.17, h * 0.16, d * 0.28, trim, 0, h * 0.12, -d * 0.20, assembly);
    const vertices = new Float32Array(18);
    corners.forEach((corner, i) => [-h / 2, h / 2].forEach((y, j) => corner.clone().setY(y).applyQuaternion(assembly.quaternion).toArray(vertices, (i * 2 + j) * 3)));
    collider = { type: 'convex', vertices };
    activeFace = { start: corners[0].clone().applyQuaternion(assembly.quaternion), end: corners[1].clone().applyQuaternion(assembly.quaternion), normal: new THREE.Vector3(0, 0, -1).applyQuaternion(assembly.quaternion) };
  } else if (kind === 'ball') {
    ballMaterial = new THREE.MeshPhysicalMaterial({ color: p.color, metalness: p.metalness, roughness: p.roughness, clearcoat: 1, emissive: p.neon, emissiveIntensity: p.emissiveIntensity * 0.06 });
    mesh(new THREE.SphereGeometry(w / 2, 48, 32), ballMaterial);
  } else if (kind === 'post') {
    cylinder(w * 0.5, w * 0.5, h * 0.12, trim, -h * 0.43);
    cylinder(w * 0.3, w * 0.4, h * 0.7, metal);
    ring(w * 0.38, w * 0.1, h * 0.16, rubber);
    cylinder(w * 0.36, w * 0.44, h * 0.16, trim, h * 0.4);
    ring(w * 0.3, w * 0.06, h * 0.49, neon);
  } else if (kind === 'wall' || kind === 'rail') {
    box(w, h * 0.8, d, metal, 0, -h * 0.1);
    box(w * 0.96, h * 0.06, d * 0.6, neon, 0, h * 0.34);
    box(w * 0.94, h * 0.12, d * 0.9, trim, 0, h * 0.44);
    if (kind === 'rail') {
      for (const x of [-w * 0.4, w * 0.4]) box(Math.min(0.2, w * 0.1), h, d * 1.2, rubber, x);
    }
  } else if (kind === 'launcher') {
    box(w, h, d * 0.35, metal, 0, 0, d * 0.3);
    box(w * 0.7, h * 0.6, d * 0.3, trim, 0, 0, -d * 0.36, animated);
    const shaft = cylinder(w * 0.12, w * 0.12, d * 0.65, trim, 0, animated); shaft.rotation.x = Math.PI / 2;
    for (let i = 0; i < 9; i++) { const spring = mesh(new THREE.TorusGeometry(w * 0.23, w * 0.035, 8, 24), trim, 0, 0, -d * 0.2 + i * d * 0.055, animated); spring.name = 'spring-coil'; }
    box(w * 0.72, h * 0.05, d * 0.22, neon, 0, h * 0.52, d * 0.3);
  } else {
    animated.position.x = -w * 0.46;
    box(w * 0.92, h * 0.18, d, trim, w * 0.46, 0, 0, animated);
    box(w * 0.75, h * 0.055, d * 0.6, neon, w * 0.46, h * 0.12, 0, animated);
    for (const x of [-w * 0.46, w * 0.46]) box(w * 0.08, h * 0.9, d * 1.1, metal, x, -h * 0.08);
  }
  let state: VisualState = 'Idle'; let elapsed = 0; let amount = 0;
  let flipperAngle = 0.18;
  return { root, size, collider, activeFace,
    setState(value) { if (!states[kind].includes(value) || (state === value && value !== 'Hit')) return; state = value; elapsed = 0; },
    setAmount(value) { amount = THREE.MathUtils.clamp(value, 0, 1); },
    update(delta) {
      elapsed += delta; const pulse = state === 'Hit' ? Math.max(0, 1 - elapsed / 0.35) : 0;
      neon.emissiveIntensity = p.emissiveIntensity * (1 + pulse * 1.8);
      if (ballMaterial) ballMaterial.emissiveIntensity = p.emissiveIntensity * (0.06 + pulse * 0.4);
      if (kind === 'flipper') neon.emissiveIntensity += state === 'Activate' ? p.emissiveIntensity * 0.5 : 0;
      // In the game Rapier supplies the root pose; the showroom previews the same rest/active angles.
      if (kind === 'flipper' && !options.externalPose) { flipperAngle = approachAngle(flipperAngle, state === 'Activate' ? -0.62 : 0.18, state === 'Activate' ? PHYSICS_3D.flipperAngularSpeed : PHYSICS_3D.flipperReturnSpeed, delta); root.rotation.y = flipperYaw(flipperAngle) * (options.side === 'right' ? -1 : 1); }
      if (kind === 'bumper') animated.position.y = -pulse * h * 0.12;
      if (kind === 'slingshot') { const compression = state === 'Activate' ? 1 : pulse; animated.position.z = compression * d * 0.07; neon.emissiveIntensity = p.emissiveIntensity * (1 + compression * 1.8); }
      if (kind === 'launcher') animated.position.z = (state === 'Activate' ? amount : 0) * d * 0.22 - pulse * d * 0.08;
      if (kind === 'gate') animated.rotation.z = THREE.MathUtils.damp(animated.rotation.z, state === 'Activate' ? Math.PI / 2 : 0, 18, delta);
      if (state === 'Hit' && elapsed >= 0.35) state = 'Idle';
    },
    dispose() { const geometries = new Set<THREE.BufferGeometry>(); const materials = new Set<THREE.Material>([metal, trim, rubber, neon]); root.traverse(object => { if (object instanceof THREE.Mesh) { geometries.add(object.geometry); for (const m of Array.isArray(object.material) ? object.material : [object.material]) materials.add(m); } }); geometries.forEach(g => g.dispose()); materials.forEach(m => m.dispose()); root.removeFromParent(); },
  };
}
