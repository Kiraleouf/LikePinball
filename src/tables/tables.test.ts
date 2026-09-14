import { describe, expect, it } from 'vitest';
import { getTable } from '.';

describe('définitions de plateaux', () => {
  it('charge deux géométries distinctes sans dupliquer la scène', () => {
    const table0 = getTable(0);
    const table1 = getTable(1);

    expect(table0.name).toBe('Plateau 0');
    expect(table1.name).toBe('Plateau 1');
    expect(table1.rails).not.toEqual(table0.rails);
    expect(table1.bumpers).not.toEqual(table0.bumpers);
  });
});
