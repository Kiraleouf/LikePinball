import type { TubeDefinition, TubePoint } from './types';

export function tubeWorldPath(points: readonly TubePoint[]): { x: number; y: number; z: number }[] {
  return points.map(point => ({ x: (point.x - 360) / 45, y: point.z, z: (point.y - 540) / 50 }));
}
export function validTubePoints(points: readonly TubePoint[]): boolean {
  return points.length >= 2 && points.length <= 64 && points.every((p, i) => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z) && p.z >= 0 && p.z <= 12
    && (i > 0 && i < points.length - 1 || p.z === 0)
    && (i === 0 || Math.hypot((p.x - points[i - 1].x) / 45, (p.y - points[i - 1].y) / 50) >= 0.15));
}
export function withTubePoints(tube: TubeDefinition, points: readonly TubePoint[]): TubeDefinition {
  const fixed = points.map((p, i) => ({ ...p, z: i === 0 || i === points.length - 1 ? 0 : p.z }));
  if (!validTubePoints(fixed)) throw new Error('Le tube exige 2 à 64 points distincts, espacés et des hauteurs entre 0 et 12.');
  return { ...tube, points: fixed, entry: 0, exit: fixed.length - 1 };
}
