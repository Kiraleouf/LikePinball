import { PHYSICS } from '../config/physics';

export function flipperTipX(side: 'left' | 'right', angle: number): number {
  const config = PHYSICS.flipper[side];
  const direction = side === 'left' ? 1 : -1;
  return config.pivot.x + direction * PHYSICS.flipper.width * Math.cos(angle);
}

export function centralGap(angleState: 'restAngle' | 'activeAngle'): number {
  return flipperTipX('right', PHYSICS.flipper.right[angleState])
    - flipperTipX('left', PHYSICS.flipper.left[angleState]);
}
