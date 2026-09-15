import { parseTemplate, type SectorTemplateFile } from '../editor/template';

// Every versioned JSON in this directory is part of the delivered catalogue.
const files = import.meta.glob('./templates/*.sector.json', { eager: true, import: 'default' });
const bundled = Object.values(files).map(value => parseTemplate(JSON.stringify(value)));
export const CATALOGUE_KEY = 'likepinball.template-catalogue.v1';
export const LEGACY_INITIAL_KEY = 'likepinball.initial-template.v1';
export type TemplateStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function browserStorage(): TemplateStorage | undefined { return typeof localStorage === 'undefined' ? undefined : localStorage; }

export function validateCatalogue(templates: readonly SectorTemplateFile[]): void {
  const ids = new Set<string>(); const indices = new Map<number, string>();
  for (const template of templates) {
    parseTemplate(JSON.stringify(template));
    const { id, sectorIndex } = template.metadata;
    if (ids.has(id)) throw new Error(`Identifiant de template en doublon : ${id}`);
    ids.add(id);
    if (id === 'initial-sector' && sectorIndex !== 0) throw new Error('Le secteur initial doit conserver son index 0.');
    if (sectorIndex === 0 && id !== 'initial-sector') throw new Error('L’index 0 est réservé au secteur initial.');
    if (sectorIndex !== undefined) {
      if (indices.has(sectorIndex)) throw new Error(`Conflit : index ${sectorIndex} déjà réservé par « ${indices.get(sectorIndex)} ».`);
      indices.set(sectorIndex, template.sector.name);
    }
  }
  if (!indices.has(0)) throw new Error('Le catalogue doit contenir le secteur initial d’index 0.');
  if (!templates.some(template => template.metadata.sectorIndex === undefined)) throw new Error('Conserver au moins un template générique pour les secteurs non fixés.');
}

function overrides(storage?: TemplateStorage): SectorTemplateFile[] {
  const source = storage?.getItem(CATALOGUE_KEY);
  if (source) {
    const value: unknown = JSON.parse(source);
    if (typeof value !== 'object' || value === null || !('version' in value) || value.version !== 1 || !('templates' in value) || !Array.isArray(value.templates)) throw new Error('Catalogue local invalide.');
    const templates = value.templates.map(template => parseTemplate(JSON.stringify(template)));
    if (new Set(templates.map(template => template.metadata.id)).size !== templates.length) throw new Error('Identifiants en doublon dans le catalogue local.');
    return templates;
  }
  const legacy = storage?.getItem(LEGACY_INITIAL_KEY);
  if (!legacy) return [];
  const template = parseTemplate(legacy);
  return [{ ...template, metadata: { ...template.metadata, id: 'initial-sector', sectorIndex: 0 } }];
}

function merge(local: readonly SectorTemplateFile[]): SectorTemplateFile[] {
  const byId = new Map(bundled.map(template => [template.metadata.id, template]));
  local.forEach(template => byId.set(template.metadata.id, template));
  const result = [...byId.values()]; validateCatalogue(result);
  // Callers receive their own snapshot; a run never mutates the stored catalogue.
  return result.map(template => parseTemplate(JSON.stringify(template)));
}

export function readTemplateCatalogue(storage = browserStorage()): SectorTemplateFile[] { return merge(overrides(storage)); }
export function saveTemplate(template: SectorTemplateFile, storage = browserStorage()): void {
  if (!storage) throw new Error('Stockage local indisponible.');
  const validated = parseTemplate(JSON.stringify(template));
  const next = [...overrides(storage).filter(item => item.metadata.id !== validated.metadata.id), validated];
  merge(next); // Reject conflicts before writing anything.
  storage.setItem(CATALOGUE_KEY, JSON.stringify({ version: 1, templates: next }));
}
export function removeCustomTemplate(id: string, storage = browserStorage()): void {
  if (!storage) throw new Error('Stockage local indisponible.');
  if (bundled.some(template => template.metadata.id === id)) throw new Error('Un template livré reste dans le catalogue ; son index peut être modifié hors secteur 0.');
  const next = overrides(storage).filter(template => template.metadata.id !== id); merge(next);
  storage.setItem(CATALOGUE_KEY, JSON.stringify({ version: 1, templates: next }));
}
