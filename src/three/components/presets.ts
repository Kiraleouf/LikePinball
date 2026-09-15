import bundled from './presets.json';

export const kinds = ['flipper', 'bumper', 'post', 'ball', 'rail', 'wall', 'launcher', 'gate', 'slingshot'] as const;
export type ComponentKind = typeof kinds[number];
export interface VisualParams {
  width: number; height: number; depth: number; bevel: number; taper: number; faceAngle: number;
  metalness: number; roughness: number; emissiveIntensity: number;
  color: string; neon: string;
}
export const defaults: VisualParams = { width: 1, height: 1, depth: 1, bevel: 0.08, taper: 0.72, faceAngle: 0,
  metalness: 0.78, roughness: 0.28, emissiveIntensity: 1.4, color: '#18232d', neon: '#35e7ff' };
export const ranges: Record<Exclude<keyof VisualParams, 'color' | 'neon'>, readonly [number, number, number]> = {
  width: [0.5, 1.5, 0.01], height: [0.5, 1.5, 0.01], depth: [0.5, 1.5, 0.01], faceAngle: [-3.15, 3.15, 0.05],
  bevel: [0.01, 0.18, 0.01], taper: [0.45, 1, 0.01], metalness: [0, 1, 0.01], roughness: [0.05, 1, 0.01], emissiveIntensity: [0, 4, 0.05],
};
export interface PresetFile { version: 1; components: Partial<Record<ComponentKind, VisualParams>> }
export const STORAGE_KEY = 'likepinball.component-presets.v1';
export function defaultParams(kind: ComponentKind): VisualParams { return { ...defaults, ...(kind === 'ball' ? { color: '#d6e5ed', roughness: 0.16 } : {}) }; }
export function bundledPresets(): PresetFile { return parsePresets(JSON.stringify(bundled)); }
export function parsePresets(source: string): PresetFile {
  const data: unknown = JSON.parse(source);
  if (!data || typeof data !== 'object' || !('version' in data) || data.version !== 1 || !('components' in data)
    || !data.components || typeof data.components !== 'object' || Array.isArray(data.components)) throw new Error('Format de presets invalide (version 1 attendue).');
  const result: PresetFile = { version: 1, components: {} };
  for (const [kind, value] of Object.entries(data.components)) {
    if (!kinds.includes(kind as ComponentKind) || !value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Composant invalide.');
    const p = defaultParams(kind as ComponentKind);
    for (const [key, v] of Object.entries(value)) {
      if (key === 'color' || key === 'neon') { if (typeof v !== 'string' || !/^#[0-9a-f]{6}$/i.test(v)) throw new Error('Couleur invalide.'); p[key] = v; }
      else {
        const range = ranges[key as keyof typeof ranges];
        if (!Object.hasOwn(ranges, key) || !range || typeof v !== 'number' || !Number.isFinite(v) || v < range[0] || v > range[1]) throw new Error(`Paramètre invalide : ${key}`);
        p[key as keyof typeof ranges] = v;
      }
    }
    result.components[kind as ComponentKind] = p;
  }
  return result;
}
export function readPresets(): PresetFile {
  try { const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem(STORAGE_KEY); if (saved) return parsePresets(saved); }
  catch { /* A damaged local draft must not prevent playing. */ }
  return bundledPresets();
}
export function resolveParams(kind: ComponentKind, file = readPresets()): VisualParams { return { ...defaultParams(kind), ...file.components[kind] }; }
export function serializePresets(file: PresetFile): string {
  return JSON.stringify({ version: 1, components: Object.fromEntries(kinds.map(kind => [kind, resolveParams(kind, file)])) }, null, 2);
}
