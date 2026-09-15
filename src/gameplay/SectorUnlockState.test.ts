import { describe, expect, it } from 'vitest';
import { SectorUnlockState } from './SectorUnlockState';
import { sectorUnlockScore } from '../config/game';

describe('SectorUnlockState', () => {
  it('ouvre chaque passage exactement à son seuil et le garde ouvert', () => {
    const thresholds = [10_000, 50_000, 100_000, 175_000];
    const state = new SectorUnlockState((sector) => thresholds[sector - 1] ?? Number.POSITIVE_INFINITY);
    expect(state.update(9_999)).toEqual([]);
    expect(state.update(10_000)).toEqual([0]);
    expect(state.update(49_999)).toEqual([]);
    expect(state.update(100_000)).toEqual([1, 2]);
    expect(state.update(120_000)).toEqual([]);
    expect(state.highestAccessibleSector).toBe(3);
    expect(state.nextThreshold).toBe(175_000);
  });

  it('prolonge les objectifs au-delà des trois paliers initiaux', () => {
    expect([1, 2, 3, 4, 5].map(sectorUnlockScore)).toEqual([10_000, 50_000, 100_000, 175_000, 250_000]);
    expect(sectorUnlockScore(20)).toBeGreaterThan(sectorUnlockScore(19));
  });
});
