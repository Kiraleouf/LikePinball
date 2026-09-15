import { createGameLighting } from '../three/components/lighting';
import { flipperYaw } from '../config/physics3d';
import { createComponent, readPresets, resolveParams, type Component3D } from '../three/components';
import * as THREE from 'three';
import type { BumperDefinition, FlipperDefinition, PostDefinition, RailDefinition, SectorDefinition, WallDefinition } from '../tables/types';
import { parseTemplate, serializeTemplate, type SectorTemplateMetadata } from './template';
import { readInitialTemplate, saveInitialTemplate } from '../tables/initialTemplate';

type EditableElement =
  | ({ readonly kind: 'bumper' } & BumperDefinition)
  | ({ readonly kind: 'flipper' } & FlipperDefinition)
  | ({ readonly kind: 'obstacle' } & WallDefinition & { readonly id: string })
  | ({ readonly kind: 'wall' } & WallDefinition & { readonly id: string })
  | ({ readonly kind: 'post' } & PostDefinition)
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
  private editingInitial = true;
  private metadata?: SectorTemplateMetadata;
  private readonly baseVisuals = new THREE.Group();

  public constructor(private readonly root: HTMLElement) {
    root.classList.add('editor-mode');
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping; this.renderer.toneMappingExposure = 1.3;
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.shadowMap.enabled = true;
    root.append(this.renderer.domElement, this.createPanel());
    this.createScene(); this.bind(); this.openInitial(); this.resize(); this.render();
  }

  private createScene(): void {
    this.scene.background = new THREE.Color(0x020508);
    createGameLighting(this.scene);
    const board = new THREE.Mesh(new THREE.BoxGeometry(12, 0.5, 20), new THREE.MeshStandardMaterial({ color: 0x071014, roughness: 0.76, metalness: 0.25 }));
    board.receiveShadow = true; board.position.y = -0.25; this.scene.add(board);
    const grid = new THREE.GridHelper(20, 20, CYAN, 0x123a44); grid.scale.x = 0.6; grid.position.y = 0.01; this.scene.add(grid);
    this.addBoundary(-5.8); this.addBoundary(5.8);
    this.addConnectionZone(-9.35, 'ENTRÉE HAUTE'); this.addConnectionZone(9.35, 'SORTIE BASSE');
    this.camera.position.set(0, 22, 17); this.camera.lookAt(0, 0, 0);
    this.scene.add(this.baseVisuals);
    const fixed = (kind: Parameters<typeof createComponent>[0], x: number, y: number, z: number, size?: { x: number; y: number; z: number }): void => {
      const component = createComponent(kind, { params: resolveParams(kind, this.visualPresets), size });
      component.root.position.set(x, y, z); this.baseVisuals.add(component.root);
    };
    fixed('wall', 4.05, 0.45, 3.7, { x: 0.24, y: 1.24, z: 11.2 });
    fixed('launcher', 4.75, 0.62, 8.75); fixed('gate', 4.65, 0.45, 5.8);
    const drain = new THREE.Mesh(new THREE.BoxGeometry(8, 0.04, 0.7), new THREE.MeshBasicMaterial({ color: 0xff3b78, transparent: true, opacity: 0.35 })); drain.position.set(0, 0.04, 9.5); this.baseVisuals.add(drain);
  }

  private addBoundary(x: number): void { const wall = createComponent('wall', { params: resolveParams('wall', this.visualPresets), size: { x: 0.36, y: 1.3, z: 20 } }).root; wall.position.set(x, 0.5, 0); this.scene.add(wall); }
  private addConnectionZone(z: number, name: string): void { const zone = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.04, 0.8), new THREE.MeshBasicMaterial({ color: 0x39ff9a, transparent: true, opacity: 0.3 })); zone.position.set(0, 0.04, z); zone.name = name; this.scene.add(zone); }

  private createPanel(): HTMLElement {
    const panel = document.createElement('aside'); panel.className = 'editor-panel';
    panel.innerHTML = `<header><span>LIKEPINBALL</span><strong>SECTOR LAB</strong><a href="/?showroom=1">STUDIO</a><a href="/">QUITTER</a></header>
      <section><button id="open-initial">OUVRIR LE SECTEUR 0</button><label>NOM DU TEMPLATE<input id="template-name" value="Nouveau secteur"></label><p id="template-context"></p></section>
      <section><span class="panel-label">AJOUTER</span><div class="tool-grid"><button data-add="bumper">BUMPER</button><button data-add="flipper">FLIPPER</button><button data-add="post">POST</button><button data-add="wall">MUR</button><button data-add="obstacle">OBSTACLE</button><button data-add="rail">RAIL</button></div><label>ÉLÉMENT<select id="element-list"></select></label></section>
      <section id="properties"><span class="panel-label">PROPRIÉTÉS</span><p>Sélectionne un élément sur le plateau.</p></section>
      <section class="editor-actions"><button id="apply-initial" class="primary">SAUVEGARDER POUR LES RUNS</button><button id="new-template">NOUVEAU</button><button id="load-template">CHARGER</button><button id="save-template">EXPORTER JSON</button><button id="test-template">TESTER LE SECTEUR</button><input id="template-file" type="file" accept="application/json,.json" hidden><p role="status" id="editor-status"></p></section>
      <footer><span class="connection-key"></span> ZONES DE CONNEXION · SNAP 20 PX</footer>`;
    panel.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((button) => button.addEventListener('click', () => this.add(button.dataset.add as EditableElement['kind'])));
    panel.querySelector('#new-template')?.addEventListener('click', () => this.reset());
    panel.querySelector('#open-initial')?.addEventListener('click', () => this.openInitial());
    panel.querySelector('#apply-initial')?.addEventListener('click', () => this.applyInitial());
    panel.querySelector<HTMLSelectElement>('#element-list')?.addEventListener('change', event => { this.selectedId = (event.currentTarget as HTMLSelectElement).value || undefined; this.rebuild(); this.showProperties(); });
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
    addEventListener('keydown', (event) => { if (event.target instanceof HTMLElement && event.target.closest('input,select,textarea')) return; if ((event.code === 'Delete' || event.code === 'Backspace') && this.selectedId) { event.preventDefault(); this.removeSelected(); } });
  }

  private add(kind: EditableElement['kind']): void {
    let id: string; do { id = `${kind}-${this.serial++}`; } while (this.elements.some(element => element.id === id));
    if (kind === 'bumper') this.elements.push({ kind, id, x: 360, y: 500, radius: 48, score: 1_250, color: CYAN });
    if (kind === 'flipper') this.elements.push({ kind, id, x: 360, y: 720, side: 'left', restAngle: 0, activeAngle: -0.65 });
    if (kind === 'obstacle' || kind === 'wall') this.elements.push({ kind, id, x: 360, y: 500, width: 150, height: 24, angle: 0 });
    if (kind === 'post') this.elements.push({ kind, id, x: 360, y: 700, radius: 11 });
    if (kind === 'rail') this.elements.push({ kind, id, points: [{ x: 280, y: 500 }, { x: 440, y: 500 }], thickness: 12, color: PINK });
    this.selectedId = id; this.rebuild(); this.showProperties();
  }

  private rebuild(): void {
    if (this.selectionBox) { this.selectionBox.removeFromParent(); this.selectionBox.geometry.dispose(); (this.selectionBox.material as THREE.Material).dispose(); this.selectionBox = undefined; }
    this.components.forEach(component => component.dispose()); this.components.length = 0;
    for (const visual of this.visuals.values()) visual.removeFromParent();
    this.visuals.clear(); this.objectIds.clear();
    const list = document.getElementById('element-list') as HTMLSelectElement;
    list.replaceChildren(new Option('Sélectionner…', ''), ...this.elements.map(element => new Option(`${element.kind} · ${element.id}`, element.id)));
    list.value = this.selectedId ?? '';
    this.baseVisuals.visible = this.editingInitial;
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
    if (element.kind === 'post') {
      const diameter = element.radius * 2 / 45; add('post', { size: { x: diameter, y: 0.9, z: diameter } }); group.position.copy(this.worldPoint(element.x, element.y, 0.45));
    } else if (element.kind === 'bumper') {
      const radius = element.radius / 48; add('bumper', { size: { x: radius * 2, y: 1.2, z: radius * 2 } }); group.position.copy(this.worldPoint(element.x, element.y, 0.62));
    } else if (element.kind === 'flipper') {
      add('flipper', { side: element.side, externalPose: true }); group.rotation.y = flipperYaw(element.restAngle); group.position.copy(this.worldPoint(element.x, element.y, 0.55));
    } else if (element.kind === 'obstacle' || element.kind === 'wall') {
      add('wall', { size: { x: element.width / 45, y: 0.72, z: element.height / (element.kind === 'wall' ? 50 : 40) } }); group.rotation.y = -(element.angle ?? 0); group.position.copy(this.worldPoint(element.x, element.y, 0.36));
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
  private setPosition(x: number, y: number, refreshProperties = true): void { this.elements = this.elements.map((element) => element.id !== this.selectedId ? element : element.kind === 'rail' ? { ...element, points: element.points.map((point) => ({ x: point.x + x - element.points[0].x, y: point.y + y - element.points[0].y })) } : { ...element, x, y }); this.rebuild(); if (refreshProperties) this.showProperties(); }

  private showProperties(): void {
    const host = document.getElementById('properties'); const element = this.elements.find(({ id }) => id === this.selectedId); if (!host) return;
    if (!element) { host.innerHTML = '<span class="panel-label">PROPRIÉTÉS</span><p>Sélectionne un élément sur le plateau ou dans la liste.</p>'; return; }
    const point = element.kind === 'rail' ? element.points[0] : element;
    const angle = element.kind === 'flipper' ? element.restAngle : element.kind === 'obstacle' || element.kind === 'wall' ? element.angle ?? 0 : element.kind === 'rail' ? Math.atan2((element.points[1].y - point.y) / 50, (element.points[1].x - point.x) / 45) : undefined;
    host.innerHTML = `<span class="panel-label"></span><p>${element.kind === 'flipper' ? 'X / Y = centre du pivot. Angle en radians ; la course de frappe est conservée.' : 'Position en pixels du template. Angle en radians.'}</p><div class="property-grid"><label>X<input id="prop-x" type="number" step="0.25" value="${point.x}"></label><label>Y<input id="prop-y" type="number" step="0.25" value="${point.y}"></label>${angle === undefined ? '' : `<label>ANGLE<input id="prop-angle" type="number" step="0.05" value="${angle}"></label>`}${element.kind === 'flipper' ? '<label>CÔTÉ<select id="prop-side"><option value="left">Gauche</option><option value="right">Droite</option></select></label>' : ''}</div><button id="delete-element" class="danger">SUPPRIMER</button>`;
    host.querySelector('.panel-label')!.textContent = `${element.kind.toUpperCase()} · ${element.id}`;
    const update = (): void => {
      const x = (host.querySelector('#prop-x') as HTMLInputElement).valueAsNumber; const y = (host.querySelector('#prop-y') as HTMLInputElement).valueAsNumber;
      if (!Number.isFinite(x) || !Number.isFinite(y)) { this.message('Position invalide.'); return; }
      this.setPosition(x, y, false);
    };
    host.querySelector('#prop-x')?.addEventListener('input', update); host.querySelector('#prop-y')?.addEventListener('input', update);
    host.querySelector<HTMLInputElement>('#prop-angle')?.addEventListener('input', event => {
      const value = (event.currentTarget as HTMLInputElement).valueAsNumber; if (!Number.isFinite(value)) { this.message('Angle invalide.'); return; }
      this.elements = this.elements.map(item => {
        if (item.id !== element.id) return item;
        if (item.kind === 'flipper') return { ...item, restAngle: value, activeAngle: item.activeAngle + value - item.restAngle };
        if (item.kind === 'wall' || item.kind === 'obstacle') return { ...item, angle: value };
        if (item.kind === 'rail') {
          const origin = item.points[0]; const delta = value - Math.atan2((item.points[1].y - origin.y) / 50, (item.points[1].x - origin.x) / 45);
          return { ...item, points: item.points.map(p => { const x = (p.x - origin.x) / 45; const y = (p.y - origin.y) / 50; return { x: origin.x + (x * Math.cos(delta) - y * Math.sin(delta)) * 45, y: origin.y + (x * Math.sin(delta) + y * Math.cos(delta)) * 50 }; }) };
        }
        return item;
      }); this.rebuild();
    });
    const side = host.querySelector<HTMLSelectElement>('#prop-side');
    if (side && element.kind === 'flipper') { side.value = element.side; side.addEventListener('change', () => { const value = side.value === 'right' ? 'right' : 'left'; this.elements = this.elements.map(item => item.id === element.id && item.kind === 'flipper' ? { ...item, side: value, restAngle: -item.restAngle, activeAngle: -item.activeAngle } : item); this.rebuild(); this.showProperties(); }); }
    host.querySelector('#delete-element')?.addEventListener('click', () => this.removeSelected());
  }

  private message(text: string): void { document.getElementById('editor-status')!.textContent = text; }
  private updateContext(): void {
    document.getElementById('template-context')!.textContent = this.editingInitial ? 'Secteur 0 de la prochaine run. Lanceur, drain rose et limites restent fixes.' : 'Template libre. Le test utilise temporairement le socle du secteur 0.';
    (document.getElementById('apply-initial') as HTMLButtonElement).disabled = !this.editingInitial;
  }
  private openInitial(): void {
    try { const template = readInitialTemplate(); this.editingInitial = true; this.metadata = template.metadata; this.fromSector(template.sector); this.updateContext(); this.message('Secteur 0 chargé.'); }
    catch (error) { this.message(`Chargement impossible : ${String(error)}`); }
  }
  private applyInitial(): void {
    try { saveInitialTemplate(parseTemplate(this.json())); this.message('Secteur 0 sauvegardé. Une nouvelle run utilisera cette disposition.'); }
    catch (error) { this.message(`Sauvegarde impossible : ${String(error)}`); }
  }
  private removeSelected(): void { this.elements = this.elements.filter(({ id }) => id !== this.selectedId); this.selectedId = undefined; this.rebuild(); this.showProperties(); }
  private reset(): void { this.editingInitial = false; this.metadata = undefined; (document.getElementById('template-name') as HTMLInputElement).value = 'Nouveau secteur'; this.elements = []; this.selectedId = undefined; this.rebuild(); this.showProperties(); this.updateContext(); this.message('Nouveau template libre.'); }
  private json(): string { const json = serializeTemplate(this.toSector(), this.metadata); parseTemplate(json); return json; }
  private save(): void {
    try { const json = this.json(); const link = document.createElement('a'); link.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); link.download = `${this.templateName()}.sector.json`; link.click(); URL.revokeObjectURL(link.href); this.message('JSON exporté. La sauvegarde pour les runs est indépendante.'); }
    catch (error) { this.message(`Export impossible : ${String(error)}`); }
  }
  private async load(file?: File): Promise<void> {
    if (!file) return;
    try { const template = parseTemplate(await file.text()); this.editingInitial = template.metadata.id === 'initial-sector'; this.metadata = template.metadata; this.fromSector(template.sector); this.updateContext(); this.message('JSON chargé. Sauvegarde pour appliquer aux runs.'); }
    catch (error) { this.message(`Import impossible : ${String(error)}`); }
  }
  private test(): void { try { localStorage.setItem('likepinball.editor-test', this.json()); location.href = '/?editor-test=1'; } catch (error) { this.message(String(error)); } }

  private toSector(): SectorDefinition {
    return {
      id: 0, name: this.templateName(), offsetY: 0,
      walls: this.elements.filter((item): item is Extract<EditableElement, { kind: 'wall' }> => item.kind === 'wall').map(({ kind: _, id: __, ...item }) => item),
      bumpers: this.elements.filter((item): item is Extract<EditableElement, { kind: 'bumper' }> => item.kind === 'bumper').map(({ kind: _, ...item }) => item),
      rails: this.elements.filter((item): item is Extract<EditableElement, { kind: 'rail' }> => item.kind === 'rail').map(({ kind: _, ...item }) => item),
      obstacles: this.elements.filter((item): item is Extract<EditableElement, { kind: 'obstacle' }> => item.kind === 'obstacle').map(({ kind: _, id: __, ...item }) => item),
      flippers: this.elements.filter((item): item is Extract<EditableElement, { kind: 'flipper' }> => item.kind === 'flipper').map(({ kind: _, ...item }) => item),
      posts: this.elements.filter((item): item is Extract<EditableElement, { kind: 'post' }> => item.kind === 'post').map(({ kind: _, ...item }) => item),
    };
  }
  private fromSector(sector: SectorDefinition): void {
    (document.getElementById('template-name') as HTMLInputElement).value = sector.name;
    this.elements = [
      ...sector.bumpers.map(item => ({ kind: 'bumper' as const, ...item })),
      ...sector.flippers.map(item => ({ kind: 'flipper' as const, ...item })),
      ...(sector.posts ?? []).map(item => ({ kind: 'post' as const, ...item })),
      ...sector.walls.map((item, index) => ({ ...item, kind: 'wall' as const, id: `wall-${index + 1}` })),
      ...sector.obstacles.map((item, index) => ({ ...item, kind: 'obstacle' as const, id: `obstacle-${index + 1}` })),
      ...sector.rails.map(item => ({ kind: 'rail' as const, ...item })),
    ];
    this.serial = this.elements.length + 1; this.selectedId = undefined; this.rebuild(); this.showProperties();
  }
  private templateName(): string { return (document.getElementById('template-name') as HTMLInputElement | null)?.value.trim() || 'secteur'; }
  private worldPoint(x: number, y: number, height: number): THREE.Vector3 { return new THREE.Vector3((x - 360) / 45, height, (y - 540) / 50); }
  private snap(value: number): number { return Math.round(value / 20) * 20; }
  private resize(): void { const width = Math.max(1, this.root.clientWidth - (this.root.querySelector('.editor-panel')?.getBoundingClientRect().width ?? 300)); const height = this.root.clientHeight; this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height); this.render(); }
  private render(): void { this.renderer.render(this.scene, this.camera); }
}
