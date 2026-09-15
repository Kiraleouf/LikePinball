import type { SectorDefinition } from '../tables/types';

export interface SectorTemplateFile {
  readonly version: 1;
  readonly sector: SectorDefinition;
  readonly metadata: SectorTemplateMetadata;
}

export interface SectorTemplateMetadata {
  readonly id: string;
  readonly sectorIndex?: number;
  readonly tags: readonly string[];
  readonly weight: number;
  readonly connections: { readonly top: boolean; readonly bottom: boolean };
  readonly optionalElementIds: readonly string[];
  readonly variationSlots: readonly VariationSlot[];
}

export interface VariationSlot {
  readonly elementId: string;
  readonly maxOffsetX?: number;
  readonly maxOffsetY?: number;
  readonly angleRange?: number;
  readonly scoreMultipliers?: readonly number[];
}

export function serializeTemplate(sector: SectorDefinition, metadata: Partial<SectorTemplateMetadata> = {}): string {
  const resolved: SectorTemplateMetadata = { id: slug(sector.name), tags: [], weight: 1, connections: { top: true, bottom: true }, optionalElementIds: [], variationSlots: [], ...metadata };
  return JSON.stringify({ version: 1, sector, metadata: resolved } satisfies SectorTemplateFile, null, 2);
}

export function parseTemplate(source: string): SectorTemplateFile {
  const value: unknown = JSON.parse(source);
  if (!isRecord(value) || value.version !== 1 || !isSector(value.sector) || !isMetadata(value.metadata)) throw new Error('Template de secteur invalide ou version non supportée');
  return value as unknown as SectorTemplateFile;
}

function isSector(value: unknown): boolean {
  if (!isRecord(value)) return false;
  const point = (v: unknown): boolean => isRecord(v) && finite(v.x) && finite(v.y);
  const wall = (v: unknown): boolean => isRecord(v) && point(v) && positive(v.width) && positive(v.height) && (v.angle === undefined || finite(v.angle));
  const identified = (v: unknown): v is Record<string, unknown> => isRecord(v) && typeof v.id === 'string' && v.id.length > 0;
  const array = (key: string, valid: (v: unknown) => boolean): boolean => Array.isArray(value[key]) && value[key].every(valid);
  return typeof value.name === 'string' && Number.isInteger(value.id) && finite(value.offsetY)
    && array('walls', wall) && array('obstacles', wall)
    && array('bumpers', v => identified(v) && point(v) && positive(v.radius) && positive(v.score) && finite(v.color))
    && array('rails', v => identified(v) && positive(v.thickness) && finite(v.color) && Array.isArray(v.points) && v.points.length >= 2 && v.points.every(point) && v.points.slice(1).every((p, i) => { const a = v.points as { x: number; y: number }[]; return p.x !== a[i].x || p.y !== a[i].y; }))
    && array('flippers', v => identified(v) && point(v) && ['left', 'right'].includes(String(v.side)) && finite(v.restAngle) && finite(v.activeAngle))
    && (value.posts === undefined || array('posts', v => identified(v) && point(v) && positive(v.radius)));
}

const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const positive = (value: unknown): value is number => finite(value) && value > 0;
const strings = (value: unknown): boolean => Array.isArray(value) && value.every(item => typeof item === 'string');
function isMetadata(value: unknown): boolean {
  return isRecord(value) && typeof value.id === 'string' && value.id.length > 0 && positive(value.weight)
    && (value.sectorIndex === undefined || (Number.isSafeInteger(value.sectorIndex) && Number(value.sectorIndex) >= 0))
    && strings(value.tags) && strings(value.optionalElementIds) && Array.isArray(value.variationSlots)
    && value.variationSlots.every(v => isRecord(v) && typeof v.elementId === 'string'
      && ['maxOffsetX', 'maxOffsetY', 'angleRange'].every(key => v[key] === undefined || (finite(v[key]) && v[key] >= 0))
      && (v.scoreMultipliers === undefined || (Array.isArray(v.scoreMultipliers) && v.scoreMultipliers.length > 0 && v.scoreMultipliers.every(positive))))
    && isRecord(value.connections) && typeof value.connections.top === 'boolean' && typeof value.connections.bottom === 'boolean';
}
function slug(value: string): string { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'secteur'; }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
