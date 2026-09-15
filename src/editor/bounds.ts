import { Box3, type Object3D } from 'three';

/** Editor limits only: diagnostics must never resize the physical board. */
export const EDITOR_LIMITS = { left: -5.57, right: 5.57, top: -10, bottom: 10 } as const;
export function elementBounds(visual: Object3D): Box3 { return new Box3().setFromObject(visual); }
export function overflowSides(bounds: Box3): string[] {
  if (bounds.isEmpty()) return [];
  const sides: string[] = [];
  if (bounds.min.x < EDITOR_LIMITS.left) sides.push('gauche');
  if (bounds.max.x > EDITOR_LIMITS.right) sides.push('droite');
  if (bounds.min.z < EDITOR_LIMITS.top) sides.push('haut');
  if (bounds.max.z > EDITOR_LIMITS.bottom) sides.push('bas');
  return sides;
}
