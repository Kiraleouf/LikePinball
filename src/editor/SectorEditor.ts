import { LAUNCHER, launcherStructure, rightBoundary } from '../three/machine';
import { elementBounds, overflowSides } from './bounds';
import { tubeWorldPath, withTubePoints } from '../tables/tubePath';
import { createGameLighting } from '../three/components/lighting';
import { flipperYaw } from '../config/physics3d';
import { createComponent, readPresets, resolveParams, type Component3D } from '../three/components';
import * as THREE from 'three';
import type { TubeDefinition, TubePoint, BumperDefinition, FlipperDefinition, PostDefinition, SlingshotDefinition, RailDefinition, SectorDefinition, WallDefinition } from '../tables/types';
import { parseTemplate, serializeTemplate, type SectorTemplateMetadata } from './template';
import { readInitialTemplate } from '../tables/initialTemplate';
import { readTemplateCatalogue, saveTemplate, removeCustomTemplate } from '../tables/templateCatalogue';

type EditableElement =
  | ({ readonly kind: 'tube' } & TubeDefinition)
  | ({ readonly kind: 'bumper' } & BumperDefinition)
  | ({ readonly kind: 'flipper' } & FlipperDefinition)
  | ({ readonly kind: 'obstacle' } & WallDefinition & { readonly id: string })
  | ({ readonly kind: 'wall' } & WallDefinition & { readonly id: string })
  | ({ readonly kind: 'slingshot' } & SlingshotDefinition)
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
  private selectionBox?: THREE.Box3Helper;
  private readonly bounds = new Map<string, THREE.Box3>();
  private readonly visuals = new Map<string, THREE.Object3D>();
  private elements: EditableElement[] = [];
  private selectedId?: string;
  private dragging = false;
  private tubeDraft?: TubePoint[];
  private tubePointIndex = 0;
  private serial = 1;
  private editingInitial = true;
  private metadata?: SectorTemplateMetadata;
  private readonly baseVisuals = new THREE.Group();
  private readonly genericBoundary = new THREE.Group();

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
    this.addBoundary(-5.75); this.addBoundary(5.75, 0, 20, this.genericBoundary); this.scene.add(this.genericBoundary);
    this.addConnectionZone(-9.35, 'ENTRÉE HAUTE'); this.addConnectionZone(9.35, 'SORTIE BASSE');
    this.camera.position.set(0.8, 23, 18); this.camera.lookAt(0.8, 0, 0);
    this.scene.add(this.baseVisuals);
    const fixed = (kind: Parameters<typeof createComponent>[0], x: number, y: number, z: number, size?: { x: number; y: number; z: number }): void => {
      const component = createComponent(kind, { params: resolveParams(kind, this.visualPresets), size });
      component.root.position.set(x, y, z); this.baseVisuals.add(component.root);
    };
    const right = rightBoundary(0); this.addBoundary(5.75, right.z, right.length, this.baseVisuals);
    launcherStructure().forEach(box => {
      if (box.name.startsWith('plateau-')) { const floor = new THREE.Mesh(new THREE.BoxGeometry(box.width, box.height, box.depth), new THREE.MeshStandardMaterial({ color: 0x071014, roughness: 0.76 })); floor.position.set(box.x, box.y, box.z); this.baseVisuals.add(floor); }
      else { const component = createComponent('wall', { params: resolveParams('wall', this.visualPresets), size: { x: box.width, y: box.height, z: box.depth } }); component.root.position.set(box.x, box.y, box.z); component.root.rotation.y = box.yaw; this.baseVisuals.add(component.root); }
    });
    fixed('launcher', LAUNCHER.x, 0.62, LAUNCHER.plungerZ);
    const gate = createComponent('gate', { params: resolveParams('gate', this.visualPresets), size: { x: LAUNCHER.gateLength, y: 1.5, z: 0.3 } }); gate.root.position.set(LAUNCHER.gateX, 0.6, LAUNCHER.gateZ); gate.root.rotation.y = Math.PI / 2; this.baseVisuals.add(gate.root);
    const drain = new THREE.Mesh(new THREE.BoxGeometry(11, 0.04, 0.7), new THREE.MeshBasicMaterial({ color: 0xff3b78, transparent: true, opacity: 0.35 })); drain.position.set(0, 0.04, 9.5); this.baseVisuals.add(drain);
  }

  private addBoundary(x: number, z = 0, length = 20, parent: THREE.Object3D = this.scene): void { const wall = createComponent('wall', { params: resolveParams('wall', this.visualPresets), size: { x: 0.36, y: 1.3, z: length } }).root; wall.position.set(x, 0.42, z); parent.add(wall); }
  private addConnectionZone(z: number, name: string): void { const zone = new THREE.Mesh(new THREE.BoxGeometry(4.6, 0.04, 0.8), new THREE.MeshBasicMaterial({ color: 0x39ff9a, transparent: true, opacity: 0.3 })); zone.position.set(0, 0.04, z); zone.name = name; this.scene.add(zone); }

  private createPanel(): HTMLElement {
    const panel = document.createElement('aside'); panel.className = 'editor-panel';
    panel.innerHTML = `<header><span>LIKEPINBALL</span><strong>SECTOR LAB</strong><a href="/?showroom=1">STUDIO</a><a href="/">QUITTER</a></header>
      <section><label>TEMPLATE ACTIF<select id="template-list"></select></label><button id="open-initial">OUVRIR LE SECTEUR 0</button><label>NOM DU TEMPLATE<input id="template-name" value="Nouveau secteur"></label><label>INDEX FIXE (VIDE = GÉNÉRIQUE)<input id="sector-index" type="number" min="0" step="1" placeholder="Générique"></label><p id="template-context"></p></section>
      <section><span class="panel-label">AJOUTER</span><div class="tool-grid"><button data-add="bumper">BUMPER</button><button data-add="flipper">FLIPPER</button><button data-add="post">POST</button><button data-add="slingshot">SLINGSHOT</button><button data-add="wall">MUR</button><button data-add="obstacle">OBSTACLE</button><button data-add="rail">RAIL</button><button data-add="tube">TUBE</button></div><label>ÉLÉMENT<select id="element-list"></select></label></section>
      <section id="tube-drawing" hidden><p id="tube-drawing-help"></p><button id="finish-tube">TERMINER LE TUBE</button><button id="cancel-tube">ANNULER LE TRACÉ</button></section>
      <section id="properties"><span class="panel-label">PROPRIÉTÉS</span><p>Sélectionne un élément sur le plateau.</p></section>
      <section id="bounds-warning" class="bounds-warning" role="status" aria-label="Dépassements du plateau" hidden></section>
      <section class="editor-actions"><button id="apply-initial" class="primary">SAUVEGARDER POUR LES RUNS</button><button id="remove-template">RETIRER DES RUNS</button><button id="new-template">NOUVEAU</button><button id="load-template">CHARGER</button><button id="save-template">EXPORTER JSON</button><button id="test-template">TESTER LE SECTEUR</button><input id="template-file" type="file" accept="application/json,.json" hidden><p role="status" id="editor-status"></p></section>
      <footer><span class="connection-key"></span> ZONES DE CONNEXION · SNAP 20 PX</footer>`;
    panel.querySelectorAll<HTMLButtonElement>('[data-add]').forEach((button) => button.addEventListener('click', () => this.add(button.dataset.add as EditableElement['kind'])));
    panel.querySelector('#finish-tube')?.addEventListener('click', () => this.finishTube());
    panel.querySelector('#cancel-tube')?.addEventListener('click', () => { this.tubeDraft = undefined; this.rebuild(); });
    panel.querySelector('#new-template')?.addEventListener('click', () => this.reset());
    panel.querySelector('#open-initial')?.addEventListener('click', () => this.openInitial());
    panel.querySelector('#apply-initial')?.addEventListener('click', () => this.applyInitial());
    panel.querySelector('#remove-template')?.addEventListener('click', () => this.removeTemplate());
    panel.querySelector<HTMLSelectElement>('#template-list')?.addEventListener('change', event => this.openSaved((event.currentTarget as HTMLSelectElement).value));
    panel.querySelector<HTMLSelectElement>('#element-list')?.addEventListener('change', event => { this.selectedId = (event.currentTarget as HTMLSelectElement).value || undefined; this.tubePointIndex = 0; this.rebuild(); this.showProperties(); });
    panel.querySelector('#save-template')?.addEventListener('click', () => this.save());
    panel.querySelector('#load-template')?.addEventListener('click', () => panel.querySelector<HTMLInputElement>('#template-file')?.click());
    panel.querySelector<HTMLInputElement>('#template-file')?.addEventListener('change', (event) => void this.load((event.currentTarget as HTMLInputElement).files?.[0]));
    panel.querySelector('#test-template')?.addEventListener('click', () => this.test());
    return panel;
  }

  private bind(): void {
    addEventListener('resize', () => this.resize());
    this.renderer.domElement.addEventListener('pointerdown', (event) => { if (this.tubeDraft) { this.drawTubePoint(event); return; } this.dragging = true; this.pick(event); });
    this.renderer.domElement.addEventListener('pointermove', (event) => { if (this.dragging && this.selectedId) this.moveSelected(event); });
    addEventListener('pointerup', () => { this.dragging = false; });
    addEventListener('keydown', (event) => { if (event.target instanceof HTMLElement && event.target.closest('input,select,textarea')) return; if (this.tubeDraft && event.code === 'Enter') { this.finishTube(); return; } if (event.code === 'Escape') { this.tubeDraft = undefined; this.rebuild(); return; } if ((event.code === 'Delete' || event.code === 'Backspace') && this.selectedId) { event.preventDefault(); this.removeSelected(); } });
  }

  private add(kind: EditableElement['kind']): void {
    if (kind === 'tube') { this.tubeDraft = []; this.selectedId = undefined; this.rebuild(); this.showProperties(); return; }
    let id: string; do { id = `${kind}-${this.serial++}`; } while (this.elements.some(element => element.id === id));
    if (kind === 'bumper') this.elements.push({ kind, id, x: 360, y: 500, radius: 48, score: 1_250, color: CYAN });
    if (kind === 'flipper') this.elements.push({ kind, id, x: 360, y: 720, side: 'left', restAngle: 0, activeAngle: -0.65 });
    if (kind === 'obstacle' || kind === 'wall') this.elements.push({ kind, id, x: 360, y: 500, width: 150, height: 24, angle: 0 });
    if (kind === 'slingshot') this.elements.push({ kind, id, x: 360, y: 700, angle: 0 });
    if (kind === 'post') this.elements.push({ kind, id, x: 360, y: 700, radius: 11 });
    if (kind === 'rail') this.elements.push({ kind, id, points: [{ x: 280, y: 500 }, { x: 440, y: 500 }], thickness: 12, color: PINK });
    this.selectedId = id; this.rebuild(); this.showProperties();
  }

  private rebuild(): void {
    if (this.selectionBox) { this.selectionBox.removeFromParent(); this.selectionBox.geometry.dispose(); (this.selectionBox.material as THREE.Material).dispose(); this.selectionBox = undefined; }
    this.components.forEach(component => component.dispose()); this.components.length = 0;
    for (const visual of this.visuals.values()) visual.removeFromParent();
    this.visuals.clear(); this.objectIds.clear(); this.bounds.clear();
    const list = document.getElementById('element-list') as HTMLSelectElement;
    list.replaceChildren(new Option('Sélectionner…', ''), ...this.elements.map(element => new Option(`${element.kind} · ${element.id}`, element.id)));
    list.value = this.selectedId ?? '';
    this.baseVisuals.visible = this.editingInitial; this.genericBoundary.visible = !this.editingInitial;
    for (const element of this.elements) {
      const visual = this.createVisual(element); visual.userData.selected = element.id === this.selectedId;
      visual.traverse((object) => this.objectIds.set(object, element.id)); this.visuals.set(element.id, visual); this.scene.add(visual);
      const bounds = elementBounds(visual); this.bounds.set(element.id, bounds);
      if (element.id === this.selectedId) { this.selectionBox = new THREE.Box3Helper(bounds, 0xffbd35); this.scene.add(this.selectionBox); }
    }
    this.renderTubeDraft(); this.updateBoundsWarning(); this.render();
  }

  private updateBoundsWarning(): void {
    const host = document.getElementById('bounds-warning')!;
    const outside = [...this.bounds].map(([id, bounds]) => ({ id, sides: overflowSides(bounds) })).filter(item => item.sides.length);
    host.hidden = !outside.length; host.replaceChildren();
    if (!outside.length) return;
    const title = document.createElement('strong'); title.textContent = `Hors plateau · ${outside.length} élément(s)`;
    const help = document.createElement('p'); help.textContent = 'Sauvegarde autorisée. Les positions et les limites du plateau restent inchangées.';
    host.append(title, help);
    for (const { id, sides } of outside) {
      const button = document.createElement('button'); button.textContent = `${id} · ${sides.join(', ')}`;
      button.onclick = () => { this.selectedId = id; this.rebuild(); this.showProperties(); };
      host.append(button);
    }
  }

  private createVisual(element: EditableElement): THREE.Object3D {
    const group = new THREE.Group();
    const add = (kind: Parameters<typeof createComponent>[0], options: Parameters<typeof createComponent>[1] = {}) => {
      const component = createComponent(kind, { ...options, params: options.params ?? resolveParams(kind, this.visualPresets) }); this.components.push(component); group.add(component.root); return component.root;
    };
    if (element.kind === 'tube') {
      const tube = add('tube', { params: element.params, path: tubeWorldPath(element.points) });
      tube.traverse(object => { if (object.userData.tubePointIndex !== undefined) { object.visible = true; if (element.id === this.selectedId && object.userData.tubePointIndex === this.tubePointIndex && object instanceof THREE.Mesh) { object.material = (object.material as THREE.MeshStandardMaterial).clone(); (object.material as THREE.MeshStandardMaterial).color.setHex(0xffbd35); (object.material as THREE.MeshStandardMaterial).emissive.setHex(0xffbd35); } } });
    } else if (element.kind === 'post') {
      const diameter = element.radius * 2 / 45; add('post', { size: { x: diameter, y: 0.9, z: diameter } }); group.position.copy(this.worldPoint(element.x, element.y, 0.45));
    } else if (element.kind === 'bumper') {
      const radius = element.radius / 48; add('bumper', { size: { x: radius * 2, y: 1.2, z: radius * 2 } }); group.position.copy(this.worldPoint(element.x, element.y, 0.62));
    } else if (element.kind === 'slingshot') {
      const sling = add('slingshot'); group.rotation.y = -element.angle; group.position.copy(this.worldPoint(element.x, element.y, 0.36)); sling.name = element.id;
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

  private pick(event: PointerEvent): void {
    this.setRay(event);
    const hits = this.raycaster.intersectObjects([...this.visuals.values()], true);
    const first = hits[0];
    // The transparent shell must not mask its editing handles.
    const hit = hits.find(h => h.object.userData.tubePointIndex !== undefined && this.objectIds.get(h.object) === this.objectIds.get(first?.object)) ?? first;
    this.selectedId = hit ? this.objectIds.get(hit.object) : undefined;
    if (hit?.object.userData.tubePointIndex !== undefined) this.tubePointIndex = Number(hit.object.userData.tubePointIndex);
    else if (this.selectedId) {
      const rect = this.renderer.domElement.getBoundingClientRect(); let nearest = 32;
      this.visuals.get(this.selectedId)?.traverse(object => {
        if (object.userData.tubePointIndex === undefined) return;
        const point = object.getWorldPosition(new THREE.Vector3()).project(this.camera);
        const distance = Math.hypot((point.x + 1) * rect.width / 2 + rect.left - event.clientX, (1 - point.y) * rect.height / 2 + rect.top - event.clientY);
        if (distance < nearest) { nearest = distance; this.tubePointIndex = Number(object.userData.tubePointIndex); }
      });
    }
    this.rebuild(); this.showProperties();
  }
  private moveSelected(event: PointerEvent): void { this.setRay(event); const point = new THREE.Vector3(); const selected = this.elements.find(e => e.id === this.selectedId); const plane = selected?.kind === 'tube' ? new THREE.Plane(new THREE.Vector3(0, 1, 0), -(selected.points[this.tubePointIndex]?.z ?? 0) - selected.params.tubeDiameter / 2) : this.plane; if (!this.raycaster.ray.intersectPlane(plane, point)) return; this.setPosition(this.snap(point.x * 45 + 360), this.snap(point.z * 50 + 540)); }
  private setRay(event: PointerEvent): void { const rect = this.renderer.domElement.getBoundingClientRect(); this.pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1); this.raycaster.setFromCamera(this.pointer, this.camera); }
  private setPosition(x: number, y: number, refreshProperties = true): void { const selected = this.elements.find(e => e.id === this.selectedId); if (selected?.kind === 'tube') { this.updateTubePoint(selected, { x, y }, refreshProperties); return; } this.elements = this.elements.map((element) => element.id !== this.selectedId ? element : element.kind === 'tube' ? element : element.kind === 'rail' ? { ...element, points: element.points.map((point) => ({ x: point.x + x - element.points[0].x, y: point.y + y - element.points[0].y })) } : { ...element, x, y }); this.rebuild(); if (refreshProperties) this.showProperties(); }

  private showProperties(): void {
    const host = document.getElementById('properties'); const element = this.elements.find(({ id }) => id === this.selectedId); if (!host) return;
    if (!element) { host.innerHTML = '<span class="panel-label">PROPRIÉTÉS</span><p>Sélectionne un élément sur le plateau ou dans la liste.</p>'; return; }
    if (element.kind === 'tube') { this.showTubeProperties(element, host); return; }
    const point = element.kind === 'rail' ? element.points[0] : element;
    const angle = element.kind === 'flipper' ? element.restAngle : element.kind === 'obstacle' || element.kind === 'wall' || element.kind === 'slingshot' ? element.angle ?? 0 : element.kind === 'rail' ? Math.atan2((element.points[1].y - point.y) / 50, (element.points[1].x - point.x) / 45) : undefined;
    host.innerHTML = `<span class="panel-label"></span><p>${element.kind === 'flipper' ? 'X / Y = centre du pivot. Angle en radians ; la course de frappe est conservée.' : element.kind === 'slingshot' ? 'La bande néon indique la face active. Angle en radians, ajouté à l’orientation du preset Studio.' : 'Position en pixels du template. Angle en radians.'}</p><div class="property-grid"><label>X<input id="prop-x" type="number" step="0.25" value="${point.x}"></label><label>Y<input id="prop-y" type="number" step="0.25" value="${point.y}"></label>${angle === undefined ? '' : `<label>ANGLE<input id="prop-angle" type="number" step="0.05" value="${angle}"></label>`}${element.kind === 'flipper' ? '<label>CÔTÉ<select id="prop-side"><option value="left">Gauche</option><option value="right">Droite</option></select></label>' : ''}</div><button id="delete-element" class="danger">SUPPRIMER</button>`;
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
        if (item.kind === 'wall' || item.kind === 'obstacle' || item.kind === 'slingshot') return { ...item, angle: value };
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

  private drawTubePoint(event: PointerEvent): void {
    this.setRay(event); const point = new THREE.Vector3();
    if (!this.raycaster.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), point)) return;
    const next = { x: this.snap(point.x * 45 + 360), y: this.snap(point.z * 50 + 540), z: 0 };
    const draft = this.tubeDraft!; const previous = draft[draft.length - 1];
    if (draft.length >= 64 || previous && Math.hypot(next.x - previous.x, next.y - previous.y) < 10) { this.message('Espacer les points ; 64 points maximum.'); return; }
    draft.push(next); this.rebuild();
  }

  private renderTubeDraft(): void {
    const panel = document.getElementById('tube-drawing')!; panel.hidden = !this.tubeDraft;
    if (!this.tubeDraft) return;
    const points = this.tubeDraft;
    document.getElementById('tube-drawing-help')!.textContent = `Tracé du tube · ${points.length} point(s). Cliquer pour ${points.length ? 'ajouter un anneau' : 'placer l’entrée'}, puis terminer : le dernier point devient la sortie. Hauteurs réglables ensuite. Entrée = terminer, Échap = annuler.`;
    (document.getElementById('finish-tube') as HTMLButtonElement).disabled = points.length < 2;
    if (!points.length) return;
    const visual = points.length >= 2 ? createComponent('tube', { params: resolveParams('tube', this.visualPresets), path: tubeWorldPath(points) }) : createComponent('post', { size: { x: 0.2, y: 0.3, z: 0.2 } });
    if (points.length === 1) visual.root.position.copy(this.worldPoint(points[0].x, points[0].y, 0.15));
    this.components.push(visual); this.scene.add(visual.root);
  }

  private finishTube(): void {
    if (!this.tubeDraft || this.tubeDraft.length < 2) return;
    let id: string; do { id = `tube-${this.serial++}`; } while (this.elements.some(e => e.id === id));
    this.elements.push({ kind: 'tube', type: 'tube', id, points: this.tubeDraft, entry: 0, exit: this.tubeDraft.length - 1, params: resolveParams('tube', this.visualPresets) });
    this.tubeDraft = undefined; this.selectedId = id; this.tubePointIndex = 0; this.rebuild(); this.showProperties(); this.message('Tube créé. Sélectionner un anneau pour modifier sa position et sa hauteur.');
  }

  private replaceTube(tube: TubeDefinition, points: readonly TubePoint[], refresh = true): void {
    try {
      const updated = withTubePoints(tube, points);
      this.elements = this.elements.map(e => e.id === tube.id ? { ...updated, kind: 'tube' } : e);
      this.tubePointIndex = Math.min(this.tubePointIndex, points.length - 1); this.rebuild(); if (refresh) this.showProperties();
    } catch (error) { this.message(String(error)); }
  }
  private updateTubePoint(tube: TubeDefinition, patch: Partial<TubePoint>, refresh = false): void {
    this.replaceTube(tube, tube.points.map((p, i) => i === this.tubePointIndex ? { ...p, ...patch } : p), refresh);
  }

  private showTubeProperties(tube: TubeDefinition, host: HTMLElement): void {
    this.tubePointIndex = Math.min(this.tubePointIndex, tube.points.length - 1);
    const i = this.tubePointIndex; const point = tube.points[i]; const endpoint = i === 0 || i === tube.points.length - 1;
    host.innerHTML = `<span class="panel-label"></span><label>POINT DU TUBE<select id="tube-point"></select></label><p>Cliquer ou glisser un anneau pour le déplacer. X/Y : plateau ; Z : hauteur au-dessus du plateau. Entrée et sortie restent à Z = 0.</p><div class="property-grid"><label>X<input id="prop-x" type="number" step="1" value="${point.x}"></label><label>Y<input id="prop-y" type="number" step="1" value="${point.y}"></label><label>HAUTEUR Z<input id="prop-z" type="number" min="0" max="12" step="0.1" value="${point.z}" ${endpoint ? 'disabled' : ''}></label></div><button id="insert-point">AJOUTER UN POINT APRÈS</button><button id="remove-point" ${tube.points.length <= 2 ? 'disabled' : ''}>SUPPRIMER CE POINT</button><p>Diamètre intérieur : ${tube.params.tubeDiameter.toFixed(2)} · style conservé dans le template.</p><button id="tube-preset">REPRENDRE LE STYLE DU STUDIO</button><button id="test-tube">TESTER CE TUBE</button><button id="delete-element" class="danger">SUPPRIMER LE TUBE</button>`;
    host.querySelector('.panel-label')!.textContent = tube.id;
    const list = host.querySelector<HTMLSelectElement>('#tube-point')!;
    list.replaceChildren(...tube.points.map((_, n) => new Option(n === 0 ? 'Entrée · Z = 0' : n === tube.points.length - 1 ? 'Sortie · Z = 0' : `Anneau ${n}`, String(n)))); list.value = String(i);
    list.onchange = () => { this.tubePointIndex = Number(list.value); this.rebuild(); this.showProperties(); };
    for (const key of ['x', 'y', 'z'] as const) host.querySelector<HTMLInputElement>(`#prop-${key}`)!.oninput = event => {
      const value = (event.currentTarget as HTMLInputElement).valueAsNumber;
      const current = this.elements.find(e => e.id === tube.id);
      if (current?.kind === 'tube' && Number.isFinite(value)) this.updateTubePoint(current, { [key]: value });
    };
    host.querySelector<HTMLButtonElement>('#insert-point')!.onclick = () => {
      const current = this.elements.find(e => e.id === tube.id); if (current?.kind !== 'tube') return;
      const points = [...current.points]; const point = points[i]; const next = points[i + 1] ?? { x: point.x + 40, y: point.y + 40, z: 0 };
      points.splice(i + 1, 0, i === points.length - 1 ? next : { x: (point.x + next.x) / 2, y: (point.y + next.y) / 2, z: (point.z + next.z) / 2 });
      this.tubePointIndex++; this.replaceTube(current, points);
    };
    host.querySelector<HTMLButtonElement>('#remove-point')!.onclick = () => { const current = this.elements.find(e => e.id === tube.id); if (current?.kind === 'tube') this.replaceTube(current, current.points.filter((_, n) => n !== i)); };
    host.querySelector<HTMLButtonElement>('#tube-preset')!.onclick = () => { const params = resolveParams('tube', readPresets()); this.elements = this.elements.map(e => e.id === tube.id && e.kind === 'tube' ? { ...e, params } : e); this.rebuild(); this.showProperties(); };
    host.querySelector<HTMLButtonElement>('#test-tube')!.onclick = () => { try { localStorage.setItem('likepinball.editor-test', this.json()); location.href = `/?editor-test=1&tube-test=${encodeURIComponent(tube.id)}`; } catch (error) { this.message(String(error)); } };
    host.querySelector('#delete-element')?.addEventListener('click', () => this.removeSelected());
  }

  private message(text: string): void { document.getElementById('editor-status')!.textContent = text; }
  private updateContext(): void {
    document.getElementById('template-context')!.textContent = this.editingInitial ? 'Secteur initial fixe 0. Lanceur, drain rose et limites restent fixes.' : 'Index 10 = secteur 10 (le départ est 0). Vide = sélection procédurale par seed. Sauvegarder pour appliquer à la prochaine run.';
    const input = document.getElementById('sector-index') as HTMLInputElement;
    input.value = this.metadata?.sectorIndex?.toString() ?? ''; input.disabled = this.editingInitial;
    (document.getElementById('remove-template') as HTMLButtonElement).disabled = this.editingInitial;
    const list = document.getElementById('template-list') as HTMLSelectElement;
    list.replaceChildren(new Option('Choisir un template…', ''), ...readTemplateCatalogue().map(template => new Option(`${template.sector.name} · ${template.metadata.sectorIndex === undefined ? 'générique' : `index ${template.metadata.sectorIndex}`}`, template.metadata.id)));
    list.value = this.metadata?.id ?? '';
  }
  private openSaved(id: string): void {
    if (!id) return;
    try { const template = readTemplateCatalogue().find(item => item.metadata.id === id); if (!template) throw new Error('Template introuvable.'); this.editingInitial = id === 'initial-sector'; this.metadata = template.metadata; this.fromSector(template.sector); this.updateContext(); this.message('Template actif chargé.'); }
    catch (error) { this.message(String(error)); }
  }
  private removeTemplate(): void {
    try { if (!this.metadata) return; removeCustomTemplate(this.metadata.id); this.openInitial(); this.message('Template retiré des nouvelles runs. Les exports JSON restent réimportables.'); }
    catch (error) { this.message(String(error)); }
  }
  private openInitial(): void {
    try { const template = readInitialTemplate(); this.editingInitial = true; this.metadata = template.metadata; this.fromSector(template.sector); this.updateContext(); this.message('Secteur 0 chargé.'); }
    catch (error) { this.message(`Chargement impossible : ${String(error)}`); }
  }
  private applyInitial(): void {
    try { const template = parseTemplate(this.json()); saveTemplate(template); this.metadata = template.metadata; this.updateContext(); this.message(`Sauvegardé pour les nouvelles runs : ${template.metadata.sectorIndex === undefined ? 'pool générique' : `index ${template.metadata.sectorIndex}`}.`); }
    catch (error) { this.message(`Sauvegarde impossible : ${String(error)}`); }
  }
  private removeSelected(): void { this.elements = this.elements.filter(({ id }) => id !== this.selectedId); this.selectedId = undefined; this.rebuild(); this.showProperties(); }
  private reset(): void { this.tubeDraft = undefined; this.editingInitial = false; this.metadata = { id: `custom-${crypto.randomUUID()}`, tags: [], weight: 1, connections: { top: true, bottom: true }, optionalElementIds: [], variationSlots: [] }; (document.getElementById('template-name') as HTMLInputElement).value = 'Nouveau secteur'; this.elements = []; this.selectedId = undefined; this.rebuild(); this.showProperties(); this.updateContext(); this.message('Nouveau template libre.'); }
  private json(): string {
    if (this.tubeDraft) throw new Error('Terminer ou annuler le tracé du tube avant de sauvegarder.');
    const input = document.getElementById('sector-index') as HTMLInputElement;
    const sectorIndex = this.editingInitial ? 0 : input.value === '' ? undefined : input.valueAsNumber;
    if (input.validity.badInput || (sectorIndex !== undefined && (!Number.isSafeInteger(sectorIndex) || sectorIndex < 0))) throw new Error('L’index doit être un entier positif ou nul, ou rester vide.');
    const json = serializeTemplate(this.toSector(), { ...this.metadata, sectorIndex }); parseTemplate(json); return json;
  }
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
      slingshots: this.elements.filter((item): item is Extract<EditableElement, { kind: 'slingshot' }> => item.kind === 'slingshot').map(({ kind: _, ...item }) => item),
      tubes: this.elements.filter((item): item is Extract<EditableElement, { kind: 'tube' }> => item.kind === 'tube').map(({ kind: _, ...item }) => item),
      posts: this.elements.filter((item): item is Extract<EditableElement, { kind: 'post' }> => item.kind === 'post').map(({ kind: _, ...item }) => item),
    };
  }
  private fromSector(sector: SectorDefinition): void {
    this.tubeDraft = undefined; this.tubePointIndex = 0;
    (document.getElementById('template-name') as HTMLInputElement).value = sector.name;
    this.elements = [
      ...(sector.tubes ?? []).map(item => ({ kind: 'tube' as const, ...item })),
      ...sector.bumpers.map(item => ({ kind: 'bumper' as const, ...item })),
      ...sector.flippers.map(item => ({ kind: 'flipper' as const, ...item })),
      ...(sector.slingshots ?? []).map(item => ({ kind: 'slingshot' as const, ...item })),
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
