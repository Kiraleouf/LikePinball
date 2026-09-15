import * as THREE from 'three';
import type { Component3D, Size } from './index';
import type { VisualParams } from './presets';

/** Smooth XY spline with nonnegative, smoothly interpolated heights and level mouths. */
export class TubeCurve extends THREE.Curve<THREE.Vector3> {
  private readonly horizontal: THREE.CatmullRomCurve3;
  constructor(readonly points: readonly Size[], readonly radius: number) {
    super();
    if (points.length < 2) throw new Error('Un tube exige au moins une entrée et une sortie.');
    this.horizontal = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(p.x, 0, p.z)), false, 'centripetal');
    this.arcLengthDivisions = Math.max(200, points.length * 80);
  }
  override getPoint(t: number, target = new THREE.Vector3()): THREE.Vector3 {
    this.horizontal.getPoint(t, target);
    const scaled = THREE.MathUtils.clamp(t, 0, 1) * (this.points.length - 1);
    const index = Math.min(this.points.length - 2, Math.floor(scaled)); const u = scaled - index;
    const a = index === 0 ? 0 : this.points[index].y;
    const b = index + 1 === this.points.length - 1 ? 0 : this.points[index + 1].y;
    target.y = this.radius + a + (b - a) * u * u * (3 - 2 * u);
    return target;
  }
}

const demoPath: readonly Size[] = [{ x: -3, y: 0, z: 2.5 }, { x: -2, y: 0.8, z: 0 }, { x: 1.5, y: 1.5, z: -1 }, { x: 3, y: 0, z: -3 }];

export function createTube(params: VisualParams, points: readonly Size[] = demoPath): Component3D {
  const root = new THREE.Group(); root.name = 'tube'; root.userData.componentKind = 'tube';
  const radius = params.tubeDiameter / 2;
  const curve = new TubeCurve(points, radius);
  const length = curve.getLength(); const segments = Math.max(64, Math.min(1600, Math.ceil(length / 0.08)));
  const radial = 32;
  const inner = new THREE.TubeGeometry(curve, segments, radius, radial, false);
  const outer = new THREE.TubeGeometry(curve, segments, radius + params.tubeThickness, radial, false);
  const a = inner.getAttribute('position'); const b = outer.getAttribute('position');
  const vertices = new Float32Array((a.count + b.count) * 3); vertices.set(a.array); vertices.set(b.array, a.count * 3);
  for (let row = 0; row <= segments; row++) for (const offset of [0, a.count]) {
    const first = (offset + row * (radial + 1)) * 3; const last = first + radial * 3;
    vertices.copyWithin(last, first, first + 3);
  }
  const indices: number[] = [];
  const innerIndices = inner.getIndex()!; const outerIndices = outer.getIndex()!;
  // Inner winding faces the bore. Both skins and annular end lips form one welded mesh.
  for (let i = 0; i < innerIndices.count; i += 3) indices.push(innerIndices.getX(i + 2), innerIndices.getX(i + 1), innerIndices.getX(i));
  for (let i = 0; i < outerIndices.count; i++) indices.push(outerIndices.getX(i) + a.count);
  for (const end of [0, segments]) for (let j = 0; j < radial; j++) {
    const i = end * (radial + 1) + j; const o = i + a.count;
    if (end === 0) indices.push(i, i + 1, o, i + 1, o + 1, o);
    else indices.push(i, o, i + 1, i + 1, o, o + 1);
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
  inner.dispose(); outer.dispose();
  const glass = new THREE.MeshPhysicalMaterial({ color: params.color, metalness: params.metalness, roughness: params.roughness, transparent: true, opacity: params.tubeOpacity, depthWrite: false, side: THREE.DoubleSide, clearcoat: 1 });
  const shell = new THREE.Mesh(geometry, glass); shell.name = 'tube-shell'; shell.renderOrder = 2; root.add(shell);
  const neon = new THREE.MeshStandardMaterial({ color: params.neon, emissive: params.neon, emissiveIntensity: params.emissiveIntensity, toneMapped: false });
  const ringGeometry = new THREE.TorusGeometry((radius + params.tubeThickness) * params.tubeRingScale, params.tubeRingThickness, 8, 40);
  const ring = (t: number, index?: number): void => {
    const mesh = new THREE.Mesh(ringGeometry, neon); mesh.position.copy(curve.getPoint(t)); mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangent(t));
    if (index !== undefined) { mesh.name = `tube-control-${index}`; mesh.userData.tubePointIndex = index; }
    mesh.visible = params.tubeRings >= 0.5; root.add(mesh);
  };
  points.forEach((_, i) => ring(i / (points.length - 1), i));
  for (let distance = params.tubeRingSpacing; distance < length; distance += params.tubeRingSpacing) {
    const t = curve.getUtoTmapping(distance / length, distance);
    if (points.every((_, i) => curve.getPoint(i / (points.length - 1)).distanceTo(curve.getPoint(t)) > params.tubeRingSpacing * 0.3)) ring(t);
  }
  const size = new THREE.Box3().setFromObject(root, true).getSize(new THREE.Vector3());
  return { root, size, collider: { type: 'trimesh', vertices, indices: new Uint32Array(indices) }, tube: { curve, radius },
    setState() {}, setAmount() {}, update() {},
    dispose() { geometry.dispose(); ringGeometry.dispose(); const materials = new Set<THREE.Material>([glass, neon]); root.traverse(object => { if (object instanceof THREE.Mesh) for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material); }); materials.forEach(material => material.dispose()); root.removeFromParent(); },
  };
}
