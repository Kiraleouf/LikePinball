import { type SectorTemplateFile } from '../editor/template';
import { browserStorage, readTemplateCatalogue, saveTemplate } from './templateCatalogue';
export { browserStorage, type TemplateStorage } from './templateCatalogue';

export const INITIAL_TEMPLATE_KEY = 'likepinball.initial-template.v1';
export function readInitialTemplate(storage = browserStorage()): SectorTemplateFile {
  return readTemplateCatalogue(storage).find(template => template.metadata.sectorIndex === 0)!;
}
export function saveInitialTemplate(template: SectorTemplateFile, storage = browserStorage()): void {
  saveTemplate({ ...template, sector: { ...template.sector, id: 0, offsetY: 0 }, metadata: { ...template.metadata, id: 'initial-sector', sectorIndex: 0 } }, storage);
}
