import { describe, expect, it } from 'vitest';
import { PHYSICS } from '../config/physics';
import { generateWorld, worldY } from '.';

const WORLD = generateWorld('test-seed');

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

  it('reproduit exactement une géométrie avec le même seed', () => {
    expect(generateWorld('debug-42')).toEqual(generateWorld('debug-42'));
    expect(generateWorld('debug-42').sectors).not.toEqual(generateWorld('autre-run').sectors);
  });

  it('préserve le socle inférieur entre les runs', () => {
    const first = generateWorld('a');
    const second = generateWorld('b');
    expect(first.spawn).toEqual(second.spawn);
    expect(first.drain).toEqual(second.drain);
    expect(first.safetyPost).toEqual(second.safetyPost);
    expect(first.sectors[0].walls).toEqual(second.sectors[0].walls);
  });

  it('ne superpose aucun bumper généré dans un secteur', () => {
    for (const sector of generateWorld('collision-check').sectors) {
      sector.bumpers.forEach((bumper, index) => {
        for (const other of sector.bumpers.slice(index + 1)) {
          expect(Math.hypot(bumper.x - other.x, bumper.y - other.y)).toBeGreaterThan(bumper.radius + other.radius + 16);
        }
      });
    }
  });

  it('maintient les rails générés hors des bumpers', () => {
    const distanceToSegment = (x: number, y: number, ax: number, ay: number, bx: number, by: number): number => {
      const lengthSquared = (bx - ax) ** 2 + (by - ay) ** 2;
      const ratio = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / lengthSquared));
      return Math.hypot(x - (ax + ratio * (bx - ax)), y - (ay + ratio * (by - ay)));
    };
    for (const seed of ['alpha-21', 'beta-21', 'gamma-21', 'delta-21']) {
      for (const sector of generateWorld(seed).sectors) {
        for (const bumper of sector.bumpers) {
          for (const rail of sector.rails) {
            rail.points.slice(1).forEach((point, index) => {
              const previous = rail.points[index];
              expect(distanceToSegment(bumper.x, bumper.y, previous.x, previous.y, point.x, point.y))
                .toBeGreaterThan(bumper.radius + rail.thickness / 2);
            });
          }
        }
      }
    }
  });

  it('génère des flippers secondaires asymétriques sans modifier les principaux', () => {
    const alpha = generateWorld('alpha-22', 6);
    const beta = generateWorld('beta-22', 6);
    expect(alpha.sectors[0].flippers).toEqual([]);
    expect(alpha.sectors.slice(1).every((sector) => sector.flippers.length >= 1)).toBe(true);
    expect(alpha.sectors.slice(1).map((sector) => sector.flippers)).not.toEqual(
      beta.sectors.slice(1).map((sector) => sector.flippers),
    );
    expect(alpha.sectors.slice(1).some((sector) =>
      sector.flippers.length === 1 || sector.flippers[0].y !== sector.flippers[1]?.y,
    )).toBe(true);
  });

  it('génère autant de secteurs successifs que demandé sans limite de définition', () => {
    const extended = generateWorld('long-run', 12);
    expect(extended.sectors).toHaveLength(12);
    expect(extended.sectors[11].id).toBe(11);
    expect(extended.sectors[11].offsetY).toBe(-11_000);
  });
});
