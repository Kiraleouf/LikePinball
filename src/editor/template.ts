import type { SectorDefinition } from '../tables/types';

export interface SectorTemplateFile {
  readonly version: 1;
  readonly sector: SectorDefinition;
}

export function serializeTemplate(sector: SectorDefinition): string {
  return JSON.stringify({ version: 1, sector } satisfies SectorTemplateFile, null, 2);
}

export function parseTemplate(source: string): SectorTemplateFile {
  const value: unknown = JSON.parse(source);
  if (!isRecord(value) || value.version !== 1 || !isSector(value.sector)) throw new Error('Template de secteur invalide ou version non supportée');
  return value as unknown as SectorTemplateFile;
}

function isSector(value: unknown): boolean {
  if (!isRecord(value)) return false;
  return typeof value.name === 'string' && typeof value.id === 'number' && typeof value.offsetY === 'number'
    && ['walls', 'bumpers', 'rails', 'obstacles', 'flippers'].every((key) => Array.isArray(value[key]));
}

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === 'object' && value !== null; }
