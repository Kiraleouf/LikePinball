import { describe, expect, it } from 'vitest';
import { CameraSectorState } from './CameraSectorState';

describe('CameraSectorState', () => {
  it('attend un engagement franc avant chaque transition montante ou descendante', () => {
    const state = new CameraSectorState(4, 1_000, 80, 160);
    expect(state.update(-79)).toBeUndefined();
    expect(state.update(-81)).toBe(1);
    expect(state.update(100)).toBeUndefined();
    expect(state.update(241)).toBe(0);
  });

  it('ne dépasse jamais les secteurs disponibles', () => {
    const state = new CameraSectorState(2, 1_000, 80, 160);
    expect(state.update(-100)).toBe(1);
    expect(state.update(-2_000)).toBeUndefined();
    state.setSectorCount(3);
    expect(state.update(-2_000)).toBe(2);
  });
});
