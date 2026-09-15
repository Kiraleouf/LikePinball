import type { SectorDefinition } from '../tables/types';

export interface SectorTemplateFile {
  readonly version: 1;
  readonly sector: SectorDefinition;
  readonly metadata: SectorTemplateMetadata;
}

export interface SectorTemplateMetadata {
  readonly id: string;
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
  return typeof value.name === 'string' && typeof value.id === 'number' && typeof value.offsetY === 'number'
    && ['walls', 'bumpers', 'rails', 'obstacles', 'flippers'].every((key) => Array.isArray(value[key]));
}

function isMetadata(value: unknown): boolean { return isRecord(value) && typeof value.id === 'string' && typeof value.weight === 'number' && Array.isArray(value.tags) && Array.isArray(value.optionalElementIds) && Array.isArray(value.variationSlots) && isRecord(value.connections); }
function slug(value: string): string { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'secteur'; }

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
