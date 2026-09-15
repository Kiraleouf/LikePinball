import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { createComponent, defaultParams, kinds, parsePresets, resolveParams, serializePresets } from './index';

describe('shared component library', () => {
  it('preserves the baseline collision dimensions used by the V2 game', () => {
    const expectations = {
      ball: { type: 'ball', radius: 0.42 }, bumper: { type: 'cylinder', radius: 1, halfHeight: 0.6 },
      gate: { type: 'box', half: { x: 0.75, y: 0.5, z: 0.18 } },
    } as const;
    for (const kind of Object.keys(expectations) as (keyof typeof expectations)[]) {
      const component = createComponent(kind, { params: defaultParams(kind) });
      expect(component.collider).toEqual(expectations[kind]); component.dispose();
    }
  });
  it('uses scaled dimensions for both visual bounds and round collision bodies', () => {
    const ball = createComponent('ball', { params: { ...defaultParams('ball'), width: 1.5, height: 0.5, depth: 0.5 } });
    const bounds = new THREE.Box3().setFromObject(ball.root).getSize(new THREE.Vector3());
    expect(ball.collider).toEqual({ type: 'ball', radius: 0.63 }); expect(bounds.x).toBeCloseTo(1.26); expect(bounds.y).toBeCloseTo(bounds.x);
    const bumper = createComponent('bumper', { size: { x: 3, y: 1.2, z: 3 }, params: { ...defaultParams('bumper'), width: 1.2, height: 1.5 } });
    expect(bumper.collider.type).toBe('cylinder'); expect(bumper.size.x).toBeCloseTo(3.6); expect(bumper.size.y).toBeCloseTo(1.8);
    ball.dispose(); bumper.dispose();
  });
  it('plays an impact independently per instance and restores its resting cap', () => {
    const a = createComponent('bumper'); const b = createComponent('bumper');
    a.setState('Hit'); a.update(0.1); b.update(0.1);
    expect(a.root.children[0].position.y).toBeLessThan(0); expect(b.root.children[0].position.y).toBeCloseTo(0);
    a.update(0.4); expect(a.root.children[0].position.y).toBeCloseTo(0);
    a.dispose(); b.dispose();
  });
  it('animates launcher charge and gate opening through the shared state API', () => {
    const launcher = createComponent('launcher'); launcher.setState('Activate'); launcher.setAmount(0.8); launcher.update(0.1);
    expect(launcher.root.children[0].position.z).toBeGreaterThan(0);
    launcher.setState('Hit'); launcher.update(0.5); expect(launcher.root.children[0].position.z).toBe(0);
    const gate = createComponent('gate'); gate.setState('Activate'); gate.update(0.3);
    expect(gate.root.children[0].rotation.z).toBeGreaterThan(1.5); gate.setState('Idle'); gate.update(0.4); expect(Math.abs(gate.root.children[0].rotation.z)).toBeLessThan(0.01);
    launcher.dispose(); gate.dispose();
  });
  it('releases geometry and material resources when switching components', () => {
    for (const kind of kinds) {
      const component = createComponent(kind); const scene = new THREE.Scene(); scene.add(component.root);
      const disposals: ReturnType<typeof vi.fn>[] = [];
      component.root.traverse(object => { if (object instanceof THREE.Mesh) { const fn = vi.fn(); object.geometry.addEventListener('dispose', fn); disposals.push(fn); } });
      component.dispose(); expect(component.root.parent).toBeNull(); disposals.forEach(fn => expect(fn).toHaveBeenCalled());
    }
  });
});

describe('versioned visual presets', () => {
  it('exports explicit defaults for unvisited components', () => {
    const file = parsePresets(serializePresets({ version: 1, components: {} }));
    expect(Object.keys(file.components)).toHaveLength(8);
    expect(file.components.ball?.color).toBe('#d6e5ed');
  });
  it('round trips a complete catalogue and resolves identical values for all consumers', () => {
    const components = Object.fromEntries(kinds.map(kind => [kind, { ...defaultParams(kind), roughness: 0.45 }]));
    const file = parsePresets(JSON.stringify({ version: 1, components }));
    for (const kind of kinds) expect(resolveParams(kind, file).roughness).toBe(0.45);
    expect(parsePresets(JSON.stringify(file))).toEqual(file);
  });
  it.each([
    '{"version":2,"components":{}}', '{"version":1,"components":{"unknown":{}}}',
    '{"version":1,"components":{"ball":{"width":0}}}', '{"version":1,"components":{"ball":{"roughness":2}}}',
    '{"version":1,"components":{"ball":{"neon":"red"}}}', '{"version":1,"components":{"ball":{"toString":1}}}',
    '{"version":1,"components":[]}',
  ])('rejects invalid preset input without applying partial values: %s', source => { expect(() => parsePresets(source)).toThrow(); });
});
