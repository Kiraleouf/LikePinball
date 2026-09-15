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

  it('rend l’objectif du plateau 0 atteignable en quatre impacts', () => {
    const table0 = getTable(0);
    const lowestBumperScore = Math.min(...table0.bumpers.map(({ score }) => score));

    expect(table0.targetScore).toBe(10_000);
    expect(lowestBumperScore * 4).toBeGreaterThanOrEqual(table0.targetScore);
  });

  it('place un petit post central sans fermer les passages vers le drain', () => {
    for (const table of [getTable(0), getTable(1)]) {
      expect(table.safetyPost.x).toBe(360);
      expect(table.safetyPost.y).toBeGreaterThan(925);
      expect(table.safetyPost.y).toBeLessThan(table.drain.y);
      expect(table.safetyPost.radius).toBeLessThan(16);
      expect(table.drain.width / 2 - table.safetyPost.radius).toBeGreaterThan(100);
    }
  });
});
