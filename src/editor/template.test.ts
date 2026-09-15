import { describe, expect, it } from 'vitest';
import { parseTemplate, serializeTemplate } from './template';
import type { SectorDefinition } from '../tables/types';

const sector: SectorDefinition = { id: 0, name: 'Test', offsetY: 0, walls: [], bumpers: [{ id: 'b1', x: 320, y: 420, radius: 44, score: 1_250, color: 0x35e7ff }], rails: [], obstacles: [], flippers: [] };

describe('sector template format', () => {
  it('round-trips a versioned template without losing layout', () => expect(parseTemplate(serializeTemplate(sector)).sector).toEqual(sector));
  it('rejects unsupported data', () => expect(() => parseTemplate('{"version":2}')).toThrow(/invalide/));
});
