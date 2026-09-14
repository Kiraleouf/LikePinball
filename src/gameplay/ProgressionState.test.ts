import { describe, expect, it } from 'vitest';
import { ProgressionState } from './ProgressionState';

describe('ProgressionState', () => {
  it('reste verrouillé avant 10 000 et se déverrouille exactement au seuil', () => {
    const progression = new ProgressionState(10_000);

    expect(progression.update(9_999)).toBe(false);
    expect(progression.portalUnlocked).toBe(false);
    expect(progression.update(10_000)).toBe(true);
    expect(progression.portalUnlocked).toBe(true);
  });

  it('ne redéclenche pas et borne la progression lorsque le score continue', () => {
    const progression = new ProgressionState(10_000);
    progression.update(10_250);

    expect(progression.update(11_000)).toBe(false);
    expect(progression.ratio(12_000)).toBe(1);
  });

  it('autorise la transition uniquement par le portail actif', () => {
    const progression = new ProgressionState(10_000);
    expect(progression.canEnterPortal('portal')).toBe(false);
    progression.update(10_000);
    expect(progression.canEnterPortal('wall')).toBe(false);
    expect(progression.canEnterPortal('portal')).toBe(true);
  });
});
