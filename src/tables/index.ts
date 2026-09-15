import { BACKGROUND_COLOR } from '../config/game';
import { readInitialTemplate } from './initialTemplate';
import { parseTemplate, type SectorTemplateFile, type VariationSlot } from '../editor/template';
import neonOrbit from './templates/neon-orbit.sector.json';
import splitLane from './templates/split-lane.sector.json';
import type { BumperDefinition, FlipperDefinition, SectorDefinition, WallDefinition, WorldDefinition } from './types';

const TEMPLATE_POOL: readonly SectorTemplateFile[] = [neonOrbit, splitLane].map((value) => parseTemplate(JSON.stringify(value)));

function hashSeed(seed: string): number {
  let hash = 2_166_136_261;
  for (const character of seed) { hash ^= character.charCodeAt(0); hash = Math.imul(hash, 16_777_619); }
  return hash >>> 0;
}

function randomFrom(seed: string): () => number {
  let value = hashSeed(seed);
  return () => { value += 0x6d2b79f5; let result = value; result = Math.imul(result ^ result >>> 15, result | 1); result ^= result + Math.imul(result ^ result >>> 7, result | 61); return ((result ^ result >>> 14) >>> 0) / 4_294_967_296; };
}

function chooseTemplate(random: () => number): SectorTemplateFile {
  const total = TEMPLATE_POOL.reduce((sum, template) => sum + template.metadata.weight, 0); let choice = random() * total;
  for (const template of TEMPLATE_POOL) { choice -= template.metadata.weight; if (choice <= 0) return template; }
  return TEMPLATE_POOL[TEMPLATE_POOL.length - 1];
}

function slotFor(template: SectorTemplateFile, elementId: string): VariationSlot | undefined { return template.metadata.variationSlots.find((slot) => slot.elementId === elementId); }
function offset(value: number, maximum: number | undefined, random: () => number): number { return maximum ? value + Math.round((random() * 2 - 1) * maximum) : value; }

function varyBumper(bumper: BumperDefinition, template: SectorTemplateFile, random: () => number, id: number): BumperDefinition {
  const slot = slotFor(template, bumper.id); const scores = slot?.scoreMultipliers; const multiplier = scores?.[Math.floor(random() * scores.length)] ?? 1;
  return { ...bumper, id: `s${id}-${bumper.id}`, x: offset(bumper.x, slot?.maxOffsetX, random), y: offset(bumper.y, slot?.maxOffsetY, random), score: Math.round(bumper.score * multiplier) };
}

function varyObstacle(obstacle: WallDefinition, index: number, template: SectorTemplateFile, random: () => number): WallDefinition {
  const slot = slotFor(template, `obstacle:${index}`); return { ...obstacle, angle: (obstacle.angle ?? 0) + (slot?.angleRange ? (random() * 2 - 1) * slot.angleRange : 0) };
}

function assembleSector(seed: string, id: number): SectorDefinition {
  const random = randomFrom(`${seed}:sector:${id}`); const template = chooseTemplate(random); const optional = new Set(template.metadata.optionalElementIds);
  const enabled = (elementId: string): boolean => !optional.has(elementId) || random() >= 0.42;
  const bumpers = template.sector.bumpers.filter((bumper) => enabled(bumper.id)).map((bumper) => varyBumper(bumper, template, random, id));
  const flippers: FlipperDefinition[] = id === 0 ? [] : template.sector.flippers.map((flipper) => ({ ...flipper, id: `s${id}-${flipper.id}` }));
  return {
    ...template.sector,
    id,
    name: `${template.sector.name} · ${id + 1}`,
    offsetY: -id * 1_000,
    bumpers,
    rails: template.sector.rails.map((rail) => ({ ...rail, id: `s${id}-${rail.id}`, points: rail.points.map((point) => ({ ...point })) })),
    obstacles: template.sector.obstacles.map((obstacle, index) => varyObstacle(obstacle, index, template, random)),
    flippers,
  };
}

export function generateSector(seed: string, id: number): SectorDefinition {
  if (id === 0) return readInitialTemplate().sector;
  return assembleSector(seed, id);
}

export function generateWorld(seed: string, sectorCount = 2): WorldDefinition {
  return { backgroundColor: BACKGROUND_COLOR, spawn: { x: 585, y: 940 }, drain: { x: 360, y: 1060, width: 260, height: 40 }, safetyPost: { x: 360, y: 962, radius: 11 }, sectors: Array.from({ length: sectorCount }, (_, id) => generateSector(seed, id)) };
}

export function createRunSeed(): string { return new URLSearchParams(window.location.search).get('seed') ?? crypto.randomUUID().slice(0, 8); }
export const worldY = (localY: number, offsetY: number): number => localY + offsetY;
export const availableTemplateIds = (): readonly string[] => TEMPLATE_POOL.map((template) => template.metadata.id);
