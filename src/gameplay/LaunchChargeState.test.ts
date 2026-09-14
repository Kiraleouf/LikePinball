import { describe, expect, it } from 'vitest';
import { LaunchChargeState } from './LaunchChargeState';

describe('LaunchChargeState', () => {
  it('monte à 100 %, redescend à 0 %, puis remonte en boucle', () => {
    const charge = new LaunchChargeState(1_000);
    charge.start();
    charge.update(1_000);
    expect(charge.value).toBe(1);
    charge.update(500);
    expect(charge.value).toBe(0.5);
    charge.update(500);
    expect(charge.value).toBe(0);
    charge.update(250);
    expect(charge.value).toBe(0.25);
  });

  it('restitue exactement la valeur affichée au relâchement', () => {
    const charge = new LaunchChargeState(1_000);
    charge.start();
    charge.update(640);
    expect(charge.release()).toBeCloseTo(0.64);
    expect(charge.active).toBe(false);
    expect(charge.release()).toBeUndefined();
  });
});
