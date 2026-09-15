import { describe, expect, it } from 'vitest';
import { SectorUnlockState } from './SectorUnlockState';

describe('SectorUnlockState', () => {
  it('ouvre chaque passage exactement à son seuil et le garde ouvert', () => {
    const state = new SectorUnlockState([10_000, 50_000, 100_000]);
    expect(state.update(9_999)).toEqual([]);
    expect(state.update(10_000)).toEqual([0]);
    expect(state.update(49_999)).toEqual([]);
    expect(state.update(100_000)).toEqual([1, 2]);
    expect(state.update(120_000)).toEqual([]);
    expect(state.highestAccessibleSector).toBe(3);
    expect(state.nextThreshold).toBeUndefined();
  });
});
