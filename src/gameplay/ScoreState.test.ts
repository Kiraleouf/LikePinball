import { describe, expect, it } from 'vitest';
import { ScoreState } from './ScoreState';

describe('ScoreState', () => {
  it('ajoute exactement la valeur configurée de chaque impact', () => {
    const score = new ScoreState();

    expect(score.add(500)).toBe(500);
    expect(score.add(750)).toBe(1_250);
    expect(score.value).toBe(1_250);
  });
});
