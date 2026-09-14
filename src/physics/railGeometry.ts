import type { Point, RailDefinition } from '../tables/types';

export interface RailSegment extends Point {
  readonly width: number;
  readonly height: number;
  readonly angle: number;
}

export function createRailSegments(rail: RailDefinition): RailSegment[] {
  return rail.points.slice(1).map((point, index) => {
    const previous = rail.points[index];
    const dx = point.x - previous.x;
    const dy = point.y - previous.y;
    return {
      x: previous.x + dx / 2,
      y: previous.y + dy / 2,
      width: Math.hypot(dx, dy) + rail.thickness,
      height: rail.thickness,
      angle: Math.atan2(dy, dx),
    };
  });
}
