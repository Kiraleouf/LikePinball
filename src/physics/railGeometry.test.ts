import { describe, expect, it } from 'vitest';
import { createRailSegments } from './railGeometry';

describe('createRailSegments', () => {
  it('produit une collision continue pour chaque paire de points', () => {
    const segments = createRailSegments({
      id: 'test', color: 0, thickness: 10,
      points: [{ x: 0, y: 0 }, { x: 30, y: 40 }, { x: 60, y: 40 }],
    });

    expect(segments).toHaveLength(2);
    expect(segments[0]).toMatchObject({ x: 15, y: 20, width: 60, height: 10 });
    expect(segments[1]).toMatchObject({ x: 45, y: 40, width: 40, height: 10, angle: 0 });
  });
});
