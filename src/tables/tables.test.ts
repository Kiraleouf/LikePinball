import { describe, expect, it } from 'vitest';
import { PHYSICS } from '../config/physics';
import { WORLD, worldY } from '.';

describe('monde vertical', () => {
  it('empile au moins deux secteurs dans un même repère physique', () => {
    expect(WORLD.sectors).toHaveLength(2);
    expect(WORLD.sectors[1].offsetY).toBeLessThan(WORLD.sectors[0].offsetY);
    expect(worldY(500, WORLD.sectors[1].offsetY)).toBe(-500);
  });

  it('laisse la jointure ouverte pour monter et redescendre sans portail', () => {
    const lower = WORLD.sectors[0];
    const upper = WORLD.sectors[1];
    const lowerHasCeiling = lower.walls.some((wall) => wall.width > 500 && worldY(wall.y, lower.offsetY) < 150);
    const upperHasFloor = upper.walls.some((wall) => wall.width > 500 && worldY(wall.y, upper.offsetY) > -100);
    expect(lowerHasCeiling).toBe(false);
    expect(upperHasFloor).toBe(false);
  });

  it('conserve le socle de jeu uniquement dans le secteur inférieur', () => {
    expect(WORLD.spawn.y).toBeGreaterThan(900);
    expect(WORLD.drain.y).toBeGreaterThan(WORLD.spawn.y);
    expect(WORLD.safetyPost.radius).toBeLessThan(PHYSICS.ball.radius);
  });

  it('ferme toute la largeur du couloir avec la barrière anti-retour', () => {
    const { gate } = PHYSICS.launcher;
    expect(gate.antiReturn.x).toBe(gate.x);
    expect(gate.antiReturn.width).toBeGreaterThanOrEqual(gate.width);
    expect(gate.antiReturn.height).toBeGreaterThanOrEqual(PHYSICS.ball.radius);
  });
});
