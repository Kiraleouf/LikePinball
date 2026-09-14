import { describe, expect, it } from 'vitest';
import { MotionGuard } from './MotionGuard';

describe('MotionGuard', () => {
  it('déclenche une seule impulsion après une immobilité prolongée', () => {
    const guard = new MotionGuard();

    expect(guard.update(0.1, 1_000, 0.5, 3_000)).toBe(false);
    expect(guard.update(0.1, 1_000, 0.5, 3_000)).toBe(false);
    expect(guard.update(0.1, 1_000, 0.5, 3_000)).toBe(true);
    expect(guard.update(0.1, 1_000, 0.5, 3_000)).toBe(false);
  });

  it('réinitialise le délai dès que la bille repart', () => {
    const guard = new MotionGuard();
    guard.update(0.1, 2_000, 0.5, 3_000);
    guard.update(2, 16, 0.5, 3_000);

    expect(guard.update(0.1, 1_500, 0.5, 3_000)).toBe(false);
  });
});
