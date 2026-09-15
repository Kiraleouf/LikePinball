import { BACKGROUND_COLOR } from '../config/game';
import type { BumperDefinition, RailDefinition, SectorDefinition, WallDefinition, WorldDefinition } from './types';

const SECTOR_COUNT = 4;
const COLORS = [0xff3bc8, 0xffbd35, 0x35e7ff] as const;

function hashSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (const character of seed) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16_777_619);
  }
  return hash >>> 0;
}

function randomFrom(seed: string): () => number {
  let value = hashSeed(seed);
  return () => {
    value += 0x6d2b79f5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4_294_967_296;
  };
}

function shuffled<T>(values: readonly T[], random: () => number): T[] {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swap = Math.floor(random() * (index + 1));
    [result[index], result[swap]] = [result[swap], result[index]];
  }
  return result;
}

function generateSector(id: number, random: () => number): SectorDefinition {
  const bumperSlots = shuffled([
    { x: 205, y: 330 }, { x: 360, y: 390 }, { x: 505, y: 330 },
    { x: 235, y: 570 }, { x: 475, y: 590 }, { x: 350, y: 700 },
  ], random).slice(0, 2 + Math.floor(random() * 2));
  const bumpers: BumperDefinition[] = bumperSlots.map((point, index) => ({
    id: `s${id}-bumper-${index}`, ...point, radius: 32 + Math.floor(random() * 8),
    score: 1_250 + id * 500, color: COLORS[Math.floor(random() * COLORS.length)],
  }));
  const mirror = random() > 0.5;
  const rails: RailDefinition[] = [
    { id: `s${id}-guide-a`, thickness: 11, color: COLORS[id % COLORS.length], points: [
      { x: mirror ? 140 : 580, y: 220 }, { x: mirror ? 155 : 565, y: 310 }, { x: mirror ? 140 : 580, y: 420 },
    ] },
    { id: `s${id}-guide-b`, thickness: 11, color: COLORS[(id + 1) % COLORS.length], points: [
      { x: mirror ? 580 : 140, y: 650 }, { x: mirror ? 540 : 180, y: 735 },
    ] },
  ];
  const obstacleLeft = random() > 0.5;
  const obstacles: WallDefinition[] = [{
    x: obstacleLeft ? 205 : 515, y: 805, width: 105, height: 16, angle: obstacleLeft ? 0.22 : -0.22,
  }];
  const walls: WallDefinition[] = [
    { x: 100, y: 540, width: 28, height: 920 },
    { x: 620, y: 540, width: 28, height: 920 },
  ];
  if (id === 0) walls.push(
    { x: 550, y: 670, width: 18, height: 690 },
    { x: 195, y: 980, width: 235, height: 28, angle: 0.18 },
    { x: 525, y: 980, width: 235, height: 28, angle: -0.18 },
  );
  if (id === SECTOR_COUNT - 1) walls.push({ x: 360, y: 72, width: 548, height: 28 });
  return { id, name: `Secteur ${id}`, offsetY: -id * 1_000, walls, bumpers, rails, obstacles };
}

export function generateWorld(seed: string): WorldDefinition {
  const random = randomFrom(seed);
  return {
    backgroundColor: BACKGROUND_COLOR,
    spawn: { x: 585, y: 940 },
    drain: { x: 360, y: 1060, width: 260, height: 40 },
    safetyPost: { x: 360, y: 962, radius: 11 },
    sectors: Array.from({ length: SECTOR_COUNT }, (_, id) => generateSector(id, random)),
  };
}

export function createRunSeed(): string {
  return new URLSearchParams(window.location.search).get('seed') ?? crypto.randomUUID().slice(0, 8);
}

export const worldY = (localY: number, offsetY: number): number => localY + offsetY;
