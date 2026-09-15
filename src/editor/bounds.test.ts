import { expect, it } from 'vitest';
import { Box3, Vector3 } from 'three';
import { overflowSides } from './bounds';
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
