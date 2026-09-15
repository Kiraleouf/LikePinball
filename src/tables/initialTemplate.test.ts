import { afterEach, expect, it, vi } from 'vitest';
import { generateWorld } from '.';
import { readInitialTemplate, saveInitialTemplate } from './initialTemplate';
import { parseTemplate, serializeTemplate } from '../editor/template';

afterEach(() => vi.unstubAllGlobals());
it('uses saved sector zero layout for normal runs and editor reloads', () => {
  const values = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => values.set(key, value) });
  const initial = readInitialTemplate();
  const sector = { ...initial.sector,
    flippers: initial.sector.flippers.map(f => ({ ...f, y: f.y - 20 })),
    posts: initial.sector.posts!.map(p => ({ ...p, x: p.x + 10 })),
    bumpers: initial.sector.bumpers.map(b => ({ ...b, y: b.y - 10 })),
    rails: initial.sector.rails.map(r => ({ ...r, points: r.points.map(p => ({ ...p, y: p.y - 10 })) })),
    walls: [{ x: 160, y: 700, width: 50, height: 15, angle: 0.4 }],
    obstacles: initial.sector.obstacles.map(o => ({ ...o, angle: 0.3 })),
  };
  saveInitialTemplate({ ...initial, sector });
  expect(readInitialTemplate().sector).toEqual(sector);
  expect(generateWorld('real-run').sectors[0]).toEqual(sector);
  expect(generateWorld('another-run').sectors[0]).toEqual(sector);
  expect(parseTemplate(serializeTemplate(sector, initial.metadata)).sector).toEqual(sector);
});
it.each([
  { posts: [{ id: 'bad', x: 0, y: 0, radius: -1 }] },
  { rails: [{ id: 'bad', thickness: 12, color: 0, points: [{ x: 1, y: 2 }] }] },
  { flippers: [{ id: 'bad', side: 'left', x: 0, y: 0, restAngle: null, activeAngle: 0 }] },
])('rejects invalid imported geometry: %j', invalid => {
  const initial = readInitialTemplate();
  expect(() => parseTemplate(JSON.stringify({ ...initial, sector: { ...initial.sector, ...invalid } }))).toThrow(/invalide/);
});
