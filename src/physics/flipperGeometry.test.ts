import { describe, expect, it } from 'vitest';
import { centralGap } from './flipperGeometry';

describe('géométrie des flippers', () => {
  it('conserve un drain central dangereux au repos et en action', () => {
    expect(centralGap('restAngle')).toBeGreaterThan(60);
    expect(centralGap('activeAngle')).toBeGreaterThan(90);
  });
});
