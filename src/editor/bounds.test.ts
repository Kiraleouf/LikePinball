import { expect, it } from 'vitest';
import { Box3, Group, Mesh, Vector3 } from 'three';
import { elementBounds, EDITOR_LIMITS, overflowSides } from './bounds';
import { createComponent, defaultParams } from '../three/components';
import { readTemplateCatalogue, saveTemplate } from '../tables/templateCatalogue';

it.each([
  [-6, 0, ['gauche']], [6, 0, ['droite']], [0, -10, ['haut']], [0, 10, ['bas']],
  [6, -10, ['droite', 'haut']], [0, 0, []],
])('reports overflow at %s, %s without moving the bounds', (x, z, sides) => {
  const bounds = new Box3().setFromCenterAndSize(new Vector3(x as number, 0, z as number), new Vector3(1, 1, 1));
  const before = bounds.clone(); expect(overflowSides(bounds)).toEqual(sides); expect(bounds).toEqual(before);
});

it('saves and reloads placements beyond all four borders exactly', () => {
  const data = new Map<string, string>();
  const storage = { getItem: (key: string) => data.get(key) ?? null, setItem: (key: string, value: string) => { data.set(key, value); } };
  const template = readTemplateCatalogue(storage).find(t => t.metadata.sectorIndex === 0)!;
  const slingshots = [[95.25, 740], [630.5, 740], [360, 30.75], [360, 1050.25]].map(([x, y], i) => ({ id: `edge-${i}`, x, y, angle: 0.7 }));
  saveTemplate({ ...template, sector: { ...template.sector, slingshots } }, storage);
  expect(readTemplateCatalogue(storage).find(t => t.metadata.sectorIndex === 0)!.sector.slingshots).toEqual(slingshots);
});

it.each([0, 45, 90, 135, -45, -90, -135])('fits actual slingshot vertices at %s degrees, after resizing and repeated rotations', degrees => {
  for (const [width, depth, faceAngle] of [[1, 1, 0], [1.5, 0.5, 0.4], [0.5, 1.5, -0.7]]) {
    const component = createComponent('slingshot', { params: { ...defaultParams('slingshot'), width, depth, faceAngle } });
    const parent = new Group(); parent.add(component.root); parent.position.set(2, 0.36, -3);
    parent.rotation.y = -degrees * Math.PI / 180;
    const actual = elementBounds(component.root); const points: Vector3[] = [];
    component.root.traverse(object => {
      if (!(object instanceof Mesh)) return;
      const positions = object.geometry.getAttribute('position');
      for (let i = 0; i < positions.count; i++) points.push(new Vector3().fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld));
    });
    for (const axis of ['x', 'y', 'z'] as const) {
      expect(actual.min[axis]).toBeCloseTo(Math.min(...points.map(p => p[axis])));
      expect(actual.max[axis]).toBeCloseTo(Math.max(...points.map(p => p[axis])));
    }
    for (let i = 0; i < 12; i++) { parent.rotation.y += Math.PI / 4; elementBounds(component.root); }
    parent.rotation.y = -degrees * Math.PI / 180;
    const restored = elementBounds(component.root);
    expect(restored.min.distanceTo(actual.min)).toBeLessThan(1e-8);
    expect(restored.max.distanceTo(actual.max)).toBeLessThan(1e-8);
    parent.position.x += 0.375;
    expect(elementBounds(component.root).min.x).toBeCloseTo(actual.min.x + 0.375);
    component.dispose();
  }
});

it('removes the false right/bottom overflow caused by rotating local rectangular boxes', () => {
  const component = createComponent('slingshot'); component.root.rotation.y = Math.PI / 4;
  const exact = elementBounds(component.root); const old = new Box3().setFromObject(component.root);
  expect(old.max.x - exact.max.x).toBeGreaterThan(0.1);
  expect(old.max.z - exact.max.z).toBeGreaterThan(0.1);
  component.root.position.set(EDITOR_LIMITS.right - exact.max.x - 0.001, 0, EDITOR_LIMITS.bottom - exact.max.z - 0.001);
  expect(overflowSides(elementBounds(component.root))).toEqual([]);
  expect(overflowSides(new Box3().setFromObject(component.root))).toEqual(['droite', 'bas']);
  component.dispose();
});
