import { createGameLighting } from '../three/components/lighting';
import { flipperYaw } from '../config/physics3d';
import { createComponent, readPresets, resolveParams, type Component3D } from '../three/components';
import * as THREE from 'three';
import type { BumperDefinition, FlipperDefinition, RailDefinition, SectorDefinition, WallDefinition } from '../tables/types';
import { parseTemplate, serializeTemplate } from './template';

type EditableElement =
  | ({ readonly kind: 'bumper' } & BumperDefinition)
  | ({ readonly kind: 'flipper' } & FlipperDefinition)
  | ({ readonly kind: 'obstacle' } & WallDefinition & { readonly id: string })
  | ({ readonly kind: 'rail' } & RailDefinition);

const CYAN = 0x35e7ff;
const PINK = 0xff3bc8;

export class SectorEditor {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(42, 1, 0.1, 80);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.55);
  private readonly objectIds = new Map<THREE.Object3D, string>();
  private readonly components: Component3D[] = [];
  private readonly visualPresets = readPresets();
  private selectionBox?: THREE.BoxHelper;
  private readonly visuals = new Map<string, THREE.Object3D>();
  private elements: EditableElement[] = [];
  private selectedId?: string;
  private dragging = false;
  private serial = 1;

  public constructor(private readonly root: HTMLElement) {
    root.classList.add('editor-mode');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.3;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.shadowMap.enabled = true;
    root.append(this.renderer.domElement, this.createPanel());
    this.createScene(); this.bind(); this.resize(); this.render();
  }

  private createScene(): void {
    this.scene.background = new THREE.Color(0x020508);
    createGameLighting(this.scene);
    const board = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0x071014, roughness: 0.76, metalness: 0.25 }));
    board.receiveShadow = true; board.position.y = -0.25; this.scene.add(board);
    const grid = new THREE.GridHelper(20, 20, CYAN, 0x123a44); grid.scale.x = 0.6; grid.position.y = 0.01; this.scene.add(grid);
    this.addBoundary(-5.8); this.addBoundary(5.8);
    this.addConnectionZone(-9.35, 'ENTRÉE HAUTE'); this.addConnectionZone(9.35, 'SORTIE BASSE');
    this.camera.position.set(0, 19, 15); this.camera.lookAt(0, 0, 0);
  }

  private addBoundary(x: number): void { const wall = createComponent('wall', { params: resolveParams('wall', this.visualPresets), size: { x: 0.36, y: 1.3, z: 20 } }).root; wall.position.set(x, 0.5, 0); this.scene.add(wall); }
  private addConnectionZone(z: number, name: string): void { const zone = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.04, 0.8), new THREE.MeshBasicMaterial({ color: 0x39ff9a, transparent: true, opacity: 0.3 })); zone.position.set(0, 0.04, z); zone.name = name; this.scene.add(zone); }

  private createPanel(): HTMLElement {
    const panel = document.createElement('aside'); panel.className = 'editor-panel';
    panel.innerHTML = `<header><span>LIKEPINBALL</span><strong>SECTOR LAB</strong><a href="/?showroom=1">STUDIO</a><a href="/">QUITTER</a></header>
      <section><label>NOM DU TEMPLATE<input id="template-name" value="Nouveau secteur"></label></section>
      <section><span class="panel-label">AJOUTER</span><div class="tool-grid"><button data-add="bumper">BUMPER</button><button data-add="flipper">FLIPPER</button><button data-add="obstacle">OBSTACLE</button><button data-add="rail">RAIL</button></div></section>
      <section id="properties"><span class="panel-label">PROPRIÉTÉS</span><p>Sélectionne un élément sur le plateau.</p></section>
      <section class="editor-actions"><button id="new-template">NOUVEAU</button><button id="load-template">CHARGER</button><button id="save-template">SAUVEGARDER JSON</button><button id="test-template" class="primary">TESTER LE SECTEUR</button><input id="template-file" type="file" accept="application/json,.json" hidden></section>
      <footer><span class="connection-key"></span> ZONES DE CONNEXION · SNAP 20 PX</footer>`;
    panel.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((button) => button.addEventListener('click', () => this.add(button.dataset.add as EditableElement['kind'])));
    panel.querySelector('#new-template')?.addEventListener('click', () => this.reset());
    panel.querySelector('#save-template')?.addEventListener('click', () => this.save());
    panel.querySelector('#load-template')?.addEventListener('click', () => panel.querySelector<HTMLInputElement>('#template-file')?.click());
    panel.querySelector<HTMLInputElement>('#template-file')?.addEventListener('change', (event) => void this.load((event.currentTarget as HTMLInputElement).files?.[0]));
    panel.querySelector('#test-template')?.addEventListener('click', () => this.test());
    return panel;
  }

  private bind(): void {
    addEventListener('resize', () => this.resize());
    this.renderer.domElement.addEventListener('pointerdown', (event) => { this.dragging = true; this.pick(event); });
    this.renderer.domElement.addEventListener('pointermove', (event) => { if (this.dragging && this.selectedId) this.moveSelected(event); });
    addEventListener('pointerup', () => { this.dragging = false; });
    addEventListener('keydown', (event) => { if ((event.code === 'Delete' || event.code === 'Backspace') && this.selectedId) this.removeSelected(); });
  }

  private add(kind: EditableElement['kind']): void {
    const id = `${kind}-${this.serial++}`;
    if (kind === 'bumper') this.elements.push({ kind, id, x: 360, y: 500, radius: 48, score: 1_250, color: CYAN });
    if (kind === 'flipper') this.elements.push({ kind, id, x: 360, y: 720, side: 'left', restAngle: 0, activeAngle: -0.65 });
    if (kind === 'obstacle') this.elements.push({ kind, id, x: 360, y: 500, width: 150, height: 24, angle: 0 });
    if (kind === 'rail') this.elements.push({ kind, id, points: [{ x: 280, y: 500 }, { x: 440, y: 500 }], thickness: 12, color: PINK });
    this.selectedId = id; this.rebuild(); this.showProperties();
  }

  private rebuild(): void {
    if (this.selectionBox) { this.selectionBox.removeFromParent(); this.selectionBox.geometry.dispose(); (this.selectionBox.material as THREE.Material).dispose(); this.selectionBox = undefined; }
    this.components.forEach(component => component.dispose()); this.components.length = 0;
    for (const visual of this.visuals.values()) visual.removeFromParent();
    this.visuals.clear(); this.objectIds.clear();
    for (const element of this.elements) {
      const visual = this.createVisual(element); visual.userData.selected = element.id === this.selectedId;
      visual.traverse((object) => this.objectIds.set(object, element.id)); this.visuals.set(element.id, visual); this.scene.add(visual);
      if (element.id === this.selectedId) { this.selectionBox = new THREE.BoxHelper(visual, 0xffbd35); this.scene.add(this.selectionBox); }
    }
    this.render();
  }

  private createVisual(element: EditableElement): THREE.Object3D {
    const group = new THREE.Group();
    const add = (kind: Parameters<typeof createComponent>[0], options: Parameters<typeof createComponent>[1] = {}) => {
      const component = createComponent(kind, { ...options, params: resolveParams(kind, this.visualPresets) }); this.components.push(component); group.add(component.root); return component.root;
    };
    if (element.kind === 'bumper') {
      const radius = element.radius / 48; add('bumper', { size: { x: radius * 2, y: 1.2, z: radius * 2 } }); group.position.copy(this.worldPoint(element.x, element.y, 0.62));
    } else if (element.kind === 'flipper') {
      add('flipper', { side: element.side, externalPose: true }); group.rotation.y = flipperYaw(element.restAngle); group.position.copy(this.worldPoint(element.x, element.y, 0.55));
    } else if (element.kind === 'obstacle') {
      add('wall', { size: { x: element.width / 45, y: 0.72, z: element.height / 40 } }); group.rotation.y = -(element.angle ?? 0); group.position.copy(this.worldPoint(element.x, element.y, 0.36));
    } else {
      element.points.slice(1).forEach((b, index) => {
        const a = element.points[index]; const start = this.worldPoint(a.x, a.y, 0.32); const end = this.worldPoint(b.x, b.y, 0.32); const direction = end.clone().sub(start);
        const rail = add('rail', { size: { x: direction.length(), y: 0.64, z: element.thickness / 50 } }); rail.position.copy(start).add(end).multiplyScalar(0.5); rail.rotation.y = -Math.atan2(direction.z, direction.x);
      });
    }
    return group;
  }

  private pick(event: PointerEvent): void { this.setRay(event); const hit = this.raycaster.intersectObjects([...this.visuals.values()], true)[0]; this.selectedId = hit ? this.objectIds.get(hit.object) : undefined; this.rebuild(); this.showProperties(); }
  private moveSelected(event: PointerEvent): void { this.setRay(event); const point = new THREE.Vector3(); if (!this.raycaster.ray.intersectPlane(this.plane, point)) return; this.setPosition(this.snap(point.x * 45 + 360), this.snap(point.z * 50 + 540)); }
  private setRay(event: PointerEvent): void { const rect = this.renderer.domElement.getBoundingClientRect(); this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); this.raycaster.setFromCamera(this.pointer, this.camera); }
  private setPosition(x: number, y: number): void { this.elements = this.elements.map((element) => element.id !== this.selectedId ? element : element.kind === 'rail' ? { ...element, points: element.points.map((point) => ({ x: point.x + x - element.points[0].x, y: point.y + y - element.points[0].y })) } : { ...element, x, y }); this.rebuild(); this.showProperties(); }

  private showProperties(): void {
    const host = document.getElementById('properties'); const element = this.elements.find(({ id }) => id === this.selectedId); if (!host) return;
    if (!element) { host.innerHTML = '<span class="panel-label">PROPRIÉTÉS</span><p>Sélectionne un élément sur le plateau.</p>'; return; }
    const point = element.kind === 'rail' ? element.points[0] : element; const angle = element.kind === 'flipper' ? element.restAngle : element.kind === 'obstacle' ? element.angle ?? 0 : undefined;
    host.innerHTML = `<span class="panel-label">${element.kind.toUpperCase()} · ${element.id}</span><div class="property-grid"><label>X<input id="prop-x" type="number" value="${point.x}"></label><label>Y<input id="prop-y" type="number" value="${point.y}"></label>${angle === undefined ? '' : `<label>ANGLE<input id="prop-angle" type="number" step="0.05" value="${angle}"></label>`}</div><button id="delete-element" class="danger">SUPPRIMER</button>`;
    const update = (): void => { const x = Number((document.getElementById('prop-x') as HTMLInputElement).value); const y = Number((document.getElementById('prop-y') as HTMLInputElement).value); this.setPosition(x, y); };
    host.querySelector('#prop-x')?.addEventListener('change', update); host.querySelector('#prop-y')?.addEventListener('change', update);
    host.querySelector<HTMLInputElement>('#prop-angle')?.addEventListener('change', (event) => { const value = Number((event.currentTarget as HTMLInputElement).value); this.elements = this.elements.map((item) => item.id !== element.id ? item : item.kind === 'flipper' ? { ...item, restAngle: value } : item.kind === 'obstacle' ? { ...item, angle: value } : item); this.rebuild(); this.showProperties(); });
    host.querySelector('#delete-element')?.addEventListener('click', () => this.removeSelected());
  }

  private removeSelected(): void { this.elements = this.elements.filter(({ id }) => id !== this.selectedId); this.selectedId = undefined; this.rebuild(); this.showProperties(); }
  private reset(): void { this.elements = []; this.selectedId = undefined; this.rebuild(); this.showProperties(); }
  private save(): void { const json = serializeTemplate(this.toSector()); localStorage.setItem('likepinball.editor-template', json); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); link.download = `${this.templateName()}.sector.json`; link.click(); URL.revokeObjectURL(link.href); }
  private async load(file?: File): Promise<void> { if (!file) return; const template = parseTemplate(await file.text()); this.fromSector(template.sector); }
  private test(): void { localStorage.setItem('likepinball.editor-test', serializeTemplate(this.toSector())); location.href = '/?editor-test=1'; }

  private toSector(): SectorDefinition { return { id: 0, name: this.templateName(), offsetY: 0, walls: [], bumpers: this.elements.filter((item): item is Extract<EditableElement, { kind: 'bumper' }> => item.kind === 'bumper').map(({ kind: _, ...item }) => item), rails: this.elements.filter((item): item is Extract<EditableElement, { kind: 'rail' }> => item.kind === 'rail').map(({ kind: _, ...item }) => item), obstacles: this.elements.filter((item): item is Extract<EditableElement, { kind: 'obstacle' }> => item.kind === 'obstacle').map(({ kind: _, id: __, ...item }) => item), flippers: this.elements.filter((item): item is Extract<EditableElement, { kind: 'flipper' }> => item.kind === 'flipper').map(({ kind: _, ...item }) => item) }; }
  private fromSector(sector: SectorDefinition): void { (document.getElementById('template-name') as HTMLInputElement).value = sector.name; this.elements = [...sector.bumpers.map((item) => ({ kind: 'bumper' as const, ...item })), ...sector.flippers.map((item) => ({ kind: 'flipper' as const, ...item })), ...sector.obstacles.map((item, index) => ({ kind: 'obstacle' as const, id: `obstacle-${index + 1}`, ...item })), ...sector.rails.map((item) => ({ kind: 'rail' as const, ...item }))]; this.serial = this.elements.length + 1; this.selectedId = undefined; this.rebuild(); this.showProperties(); }
  private templateName(): string { return (document.getElementById('template-name') as HTMLInputElement | null)?.value.trim() || 'secteur'; }
  private worldPoint(x: number, y: number, height: number): THREE.Vector3 { return new THREE.Vector3((x - 360) / 45, height, (y - 540) / 50); }
  private snap(value: number): number { return Math.round(value / 20) * 20; }
  private resize(): void { const width = Math.max(1, this.root.clientWidth - (this.root.querySelector('.editor-panel')?.getBoundingClientRect().width ?? 300)); const height = this.root.clientHeight; this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height); this.render(); }
  private render(): void { this.renderer.render(this.scene, this.camera); }
}
