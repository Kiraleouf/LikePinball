import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { generateSector, generateWorld } from '.';
import { parseTemplate, serializeTemplate } from '../editor/template';
import { CATALOGUE_KEY, LEGACY_INITIAL_KEY, readTemplateCatalogue, removeCustomTemplate, saveTemplate, type TemplateStorage } from './templateCatalogue';

let storage: TemplateStorage;
beforeEach(() => {
  const data = new Map<string, string>();
  storage = { getItem: key => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value); } };
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());
const custom = (id: string, sectorIndex?: number) => {
  const template = readTemplateCatalogue().find(item => item.metadata.id === 'neon-orbit')!;
  return { ...template, sector: { ...template.sector, name: id }, metadata: { ...template.metadata, id, sectorIndex } };
};

it('uses the exact fixed template at 10 and preserves seeded sectors 1–9', () => {
  const before = generateWorld('index-check', 12); const template = custom('milestone', 10);
  saveTemplate(template);
  const run = generateWorld('index-check', 12);
  expect(run.sectors[10]).toEqual({ ...template.sector, id: 10, offsetY: -10_000 });
  expect(generateSector('other-seed', 10)).toEqual(run.sectors[10]);
  expect(run.sectors.slice(1, 10)).toEqual(before.sectors.slice(1, 10));
  expect(generateWorld('index-check', 12)).toEqual(run);
  expect(generateWorld('other-seed', 10).sectors.slice(1)).not.toEqual(run.sectors.slice(1, 10));
  expect(parseTemplate(serializeTemplate(template.sector, template.metadata)).metadata.sectorIndex).toBe(10);
});
it('rejects duplicate fixed indices without overwriting the catalogue', () => {
  saveTemplate(custom('first', 10)); const previous = storage.getItem(CATALOGUE_KEY);
  expect(() => saveTemplate(custom('second', 10))).toThrow(/Conflit.*10/);
  expect(storage.getItem(CATALOGUE_KEY)).toBe(previous);
  expect(() => generateSector('seed', 10, [custom('first', 10), custom('second', 10)])).toThrow(/Plusieurs/);
});
it('returns an unfixed template to the generic seeded pool and permits removal', () => {
  saveTemplate(custom('milestone', 10)); saveTemplate(custom('milestone'));
  expect(readTemplateCatalogue().find(t => t.metadata.id === 'milestone')!.metadata.sectorIndex).toBeUndefined();
  const names = Array.from({ length: 40 }, (_, index) => generateSector(`pool-${index}`, 10).name);
  expect(names.some(name => name.startsWith('milestone'))).toBe(true);
  expect(new Set(names).size).toBeGreaterThan(1);
  removeCustomTemplate('milestone');
  expect(readTemplateCatalogue().some(t => t.metadata.id === 'milestone')).toBe(false);
});
it('reserves structural index zero and migrates the saved initial layout', () => {
  const initial = readTemplateCatalogue().find(t => t.metadata.sectorIndex === 0)!;
  storage.setItem(LEGACY_INITIAL_KEY, serializeTemplate({ ...initial.sector, name: 'Mon départ' }, { ...initial.metadata, sectorIndex: undefined }));
  expect(generateSector('seed', 0).name).toBe('Mon départ');
  saveTemplate(custom('milestone', 10));
  expect(readTemplateCatalogue().find(t => t.metadata.sectorIndex === 0)!.sector.name).toBe('Mon départ');
  expect(() => saveTemplate({ ...initial, metadata: { ...initial.metadata, sectorIndex: undefined } })).toThrow(/conserver son index 0/);
  expect(() => saveTemplate(custom('invalid-zero', 0))).toThrow(/réservé/);
  expect(() => removeCustomTemplate('initial-sector')).toThrow(/livré/);
});
it('keeps an existing run snapshot stable when a template is edited', () => {
  saveTemplate(custom('old', 10)); const snapshot = readTemplateCatalogue();
  const edited = custom('old', 10); saveTemplate({ ...edited, sector: { ...edited.sector, name: 'edited' } });
  expect(generateSector('seed', 10, snapshot).name).toBe('old');
  expect(generateSector('seed', 10).name).toBe('edited');
});
it.each([-1, 1.5, '10', null])('rejects invalid JSON indices: %j', sectorIndex => {
  const template = custom('invalid');
  expect(() => parseTemplate(JSON.stringify({ ...template, metadata: { ...template.metadata, sectorIndex } }))).toThrow(/invalide/);
});
