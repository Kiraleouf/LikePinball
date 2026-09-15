import bundled from './templates/initial-sector.sector.json';
import { parseTemplate, serializeTemplate, type SectorTemplateFile } from '../editor/template';

export const INITIAL_TEMPLATE_KEY = 'likepinball.initial-template.v1';
export type TemplateStorage = Pick<Storage, 'getItem' | 'setItem'>;
export function browserStorage(): TemplateStorage | undefined {
  return typeof localStorage === 'undefined' ? undefined : localStorage;
}
export function readInitialTemplate(storage = browserStorage()): SectorTemplateFile {
  const source = storage?.getItem(INITIAL_TEMPLATE_KEY);
  return parseTemplate(source ?? JSON.stringify(bundled));
}
export function saveInitialTemplate(template: SectorTemplateFile, storage = browserStorage()): void {
  if (!storage) throw new Error('Stockage local indisponible');
  const json = serializeTemplate({ ...template.sector, id: 0, offsetY: 0 }, { ...template.metadata, id: 'initial-sector' });
  parseTemplate(json);
  storage.setItem(INITIAL_TEMPLATE_KEY, json);
}
