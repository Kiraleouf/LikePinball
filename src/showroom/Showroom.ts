import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { createGameLighting } from '../three/components/lighting';
import { createComponent, kinds, states, ranges, bundledPresets, readPresets, resolveParams, parsePresets, serializePresets, STORAGE_KEY,
  type Component3D, type ComponentKind, type PresetFile, type VisualParams, type VisualState } from '../three/components';
import './showroom.css';

const titles: Record<ComponentKind, string> = { flipper: 'Flipper', bumper: 'Bumper', post: 'Post', ball: 'Ball', rail: 'Rail', wall: 'Wall / obstacle', launcher: 'Launcher', gate: 'One-way gate' };
const descriptions: Record<ComponentKind, string> = {
  flipper: 'Corps effilé · contour lumineux · moyeu métallique', bumper: 'Coque usinée · capot mobile · anneau d’impact',
  post: 'Socle métallique · bague de protection · couronne lumineuse', ball: 'Surface polie · reflets d’environnement · volume sphérique',
  rail: 'Profil sur supports · couronnement métallique · ligne lumineuse', wall: 'Bloc chanfreiné · insert lumineux · surface de contact',
  launcher: 'Corps guidé · ressort · piston mobile', gate: 'Supports latéraux · traverse articulée · passage contrôlé',
};
const labels: Record<keyof VisualParams, string> = { width: 'Largeur / diamètre', height: 'Hauteur', depth: 'Profondeur', bevel: 'Arrondi des arêtes', taper: 'Proportion de la pointe', metalness: 'Metalness', roughness: 'Roughness', emissiveIntensity: 'Intensité émissive', color: 'Corps', neon: 'Accent lumineux' };

export class Showroom {
  private readonly scene = new THREE.Scene();
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly camera = new THREE.PerspectiveCamera(38, 1, 0.05, 100);
  private readonly viewport = document.createElement('div');
  private readonly controls: OrbitControls;
  private readonly key = new THREE.DirectionalLight(0xe5f3ff, 3);
  private readonly fill = new THREE.HemisphereLight(0xb7dfff, 0x080c16, 1.2);
  private readonly rim = new THREE.PointLight(0x35e7ff, 22, 30);
  private readonly environment: THREE.WebGLRenderTarget;
  private readonly stage: THREE.Mesh;
  private readonly gameLighting: ReturnType<typeof createGameLighting>;
  private component!: Component3D;
  private kind: ComponentKind = 'flipper';
  private presets: PresetFile = readPresets();
  private params = resolveParams(this.kind, this.presets);
  private state: VisualState = 'Idle';
  private amount = 0.65;
  private previous = 0;
  private elapsed = 0;
  private readonly resizeObserver: ResizeObserver;
  private dirty = false;

  constructor(private readonly root: HTMLElement) {
    root.classList.add('showroom-mode'); document.title = 'LikePinball — Component Studio';
    root.innerHTML = `<header class="studio-header"><a class="studio-brand" href="/">LP<span>LIKEPINBALL<small>COMPONENT STUDIO</small></span></a><span class="studio-badge">DESIGN EXPLORATION / 01</span><nav><a href="/?editor=1">Sector Lab ↗</a><a href="/">Jouer ↗</a></nav></header>
      <aside class="studio-library"><span class="studio-eyebrow">BIBLIOTHÈQUE / 08</span><h2>Les pièces<br>de la machine.</h2><div class="component-list">${kinds.map((kind, i) => `<button data-kind="${kind}"><span>0${i + 1}</span>${titles[kind]}<b>↗</b></button>`).join('')}</div><div class="studio-note"><span class="status-dot"></span> DESIGN EN COURS<p>Explorez les formes et les matières. Ces propositions restent ouvertes à l’itération.</p></div></aside>
      <main class="studio-main"><div class="object-heading"><span class="studio-eyebrow">ÉTUDE DE COMPOSANT</span><h1 id="component-title"></h1><p id="component-description"></p></div><div id="studio-viewport"></div><div class="view-tools"><button id="frame-object">Recentrer</button><button id="auto-orbit" aria-pressed="false">Rotation auto</button><select id="lighting" aria-label="Éclairage"><option value="studio">Éclairage studio</option><option value="game">Éclairage jeu</option></select><label>Lumière<input id="light-power" type="range" min="0.2" max="3" step="0.1" value="1"></label></div><div class="studio-state"><span class="studio-eyebrow">ÉTATS</span><div id="state-buttons"></div><label id="charge-control">Charge<input id="component-charge" type="range" min="0" max="1" step="0.01" value="0.65"></label><span id="state-readout" aria-live="polite">Idle</span></div><footer class="viewport-help">GLISSER POUR ORBITER · MOLETTE POUR ZOOMER · CLIC DROIT POUR DÉPLACER</footer></main>
      <aside class="studio-inspector"><header><span class="studio-eyebrow">PARAMÈTRES</span><h2>Forme & matière</h2></header><div id="component-params"></div><section class="preset-actions"><button id="apply-preset" class="primary">Appliquer au jeu & à l’éditeur</button><div><button id="reset-component">Réinitialiser</button><button id="export-preset">Exporter JSON</button></div><button id="import-preset">Importer un preset</button><input id="preset-file" type="file" accept=".json,application/json" hidden><p id="preset-status" role="status">Preset partagé chargé. Les modifications restent en aperçu jusqu’à leur application.</p></section></aside>`;
    const host = this.element('studio-viewport'); host.append(this.viewport); this.viewport.append(this.renderer.domElement);
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); this.renderer.setClearColor(0x070b10);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace; this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3; this.renderer.shadowMap.enabled = true; this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.controls = new OrbitControls(this.camera, this.renderer.domElement); this.controls.enableDamping = true;
    this.controls.minDistance = 1; this.controls.maxDistance = 35; this.controls.maxPolarAngle = Math.PI * 0.92;
    const generator = new THREE.PMREMGenerator(this.renderer); const room = new RoomEnvironment();
    this.environment = generator.fromScene(room); this.scene.environment = this.environment.texture; room.dispose(); generator.dispose();
    this.key.position.set(-3, 7, 5); this.key.castShadow = true; this.key.shadow.mapSize.set(1024, 1024);
    this.rim.position.set(4, 3, -4); this.scene.add(this.key, this.fill, this.rim);
    this.gameLighting = createGameLighting(this.scene); this.gameLighting.setIntensity(0);
    this.stage = new THREE.Mesh(new THREE.CylinderGeometry(3.8, 4, 0.15, 96), new THREE.MeshStandardMaterial({ color: 0x111922, roughness: 0.5, metalness: 0.3 }));
    this.stage.position.y = -1; this.stage.receiveShadow = true; this.scene.add(this.stage);
    this.bind(); this.select(this.kind);
    this.resizeObserver = new ResizeObserver(() => this.resize()); this.resizeObserver.observe(host); this.resize();
    this.renderer.setAnimationLoop(time => this.update(time));
    addEventListener('pagehide', this.dispose, { once: true });
  }

  private element(id: string): HTMLElement { const node = this.root.querySelector<HTMLElement>(`#${id}`); if (!node) throw new Error(`Élément absent : ${id}`); return node; }
  private bind(): void {
    this.root.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => button.onclick = () => this.select(button.dataset.kind as ComponentKind));
    this.element('frame-object').onclick = () => this.frame();
    this.element('auto-orbit').onclick = () => { this.controls.autoRotate = !this.controls.autoRotate; this.element('auto-orbit').setAttribute('aria-pressed', String(this.controls.autoRotate)); };
    this.element('lighting').onchange = () => this.light(); this.element('light-power').oninput = () => this.light();
    this.element('component-charge').oninput = event => { this.amount = Number((event.target as HTMLInputElement).value); this.setState('Activate'); };
    this.element('apply-preset').onclick = () => {
      try { this.storeCurrent(); localStorage.setItem(STORAGE_KEY, JSON.stringify(this.presets)); this.dirty = false; this.status('Preset appliqué : le jeu et l’éditeur le chargeront à leur ouverture.'); }
      catch { this.status('Sauvegarde locale indisponible. Exportez le JSON pour conserver vos réglages.'); }
    };
    this.element('reset-component').onclick = () => { this.params = resolveParams(this.kind, bundledPresets()); this.storeCurrent(); this.build(); this.fields(); this.markDirty(); };
    this.element('export-preset').onclick = () => { this.storeCurrent(); const url = URL.createObjectURL(new Blob([serializePresets(this.presets)], { type: 'application/json' })); const link = document.createElement('a'); link.href = url; link.download = 'likepinball-components.v1.json'; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); this.status('Téléchargement JSON demandé. Son intégration au dépôt rendra ce preset disponible pour tous.'); };
    this.element('import-preset').onclick = () => (this.element('preset-file') as HTMLInputElement).click();
    this.element('preset-file').onchange = async event => {
      const input = event.target as HTMLInputElement; const file = input.files?.[0]; if (!file) return;
      try { this.presets = parsePresets(await file.text()); this.params = resolveParams(this.kind, this.presets); this.build(); this.fields(); this.markDirty(); this.status('Preset importé en aperçu. Appliquez-le pour le partager avec le jeu.'); }
      catch (error) { this.status(error instanceof Error ? error.message : 'Import impossible.'); } finally { input.value = ''; }
    };
  }
  private select(kind: ComponentKind): void {
    if (this.component) this.storeCurrent(); this.kind = kind; this.params = resolveParams(kind, this.presets); this.state = 'Idle';
    this.root.querySelectorAll<HTMLButtonElement>('[data-kind]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.kind === kind)));
    this.element('component-title').textContent = titles[kind]; this.element('component-description').textContent = descriptions[kind];
    this.element('state-buttons').innerHTML = states[kind].map(state => `<button data-state="${state}">${state === 'Hit' && kind === 'launcher' ? 'Hit / relâcher' : state}</button>`).join('');
    this.element('state-buttons').querySelectorAll<HTMLButtonElement>('button').forEach(button => button.onclick = () => this.setState(button.dataset.state as VisualState));
    this.element('charge-control').hidden = kind !== 'launcher'; this.build(); this.fields(); this.setState('Idle'); this.frame();
    const inspector = this.root.querySelector('.studio-inspector'); if (inspector) inspector.scrollTop = 0;
  }
  private build(): void {
    this.component?.dispose(); this.component = createComponent(this.kind, { params: this.params }); this.scene.add(this.component.root);
    this.component.setState(this.state); this.component.setAmount(this.amount); this.stage.position.y = -this.component.size.y / 2 - 0.1;
    const radius = Math.max(this.component.size.x, this.component.size.z, 1) * 0.7;
    this.stage.scale.set(radius / 3.8, 1, radius / 3.8);
    this.stage.position.x = this.kind === 'flipper' ? this.component.size.x * 0.32 : 0;
  }
  private fields(): void {
    const keys = (Object.keys(ranges) as (keyof typeof ranges)[]).filter(key =>
      !(key === 'taper' && this.kind !== 'flipper') && !(key === 'bevel' && ['ball', 'post', 'bumper'].includes(this.kind))
      && !(key === 'depth' && ['ball', 'post', 'bumper'].includes(this.kind)) && !(key === 'height' && this.kind === 'ball'));
    this.element('component-params').innerHTML = `<section><h3>GÉOMÉTRIE & FINITION</h3>${keys.map(key => `<label class="param-row" for="param-${key}"><span>${labels[key]}</span><output id="value-${key}">${this.params[key].toFixed(2)}</output><input id="param-${key}" data-param="${key}" type="range" min="${ranges[key][0]}" max="${ranges[key][1]}" step="${ranges[key][2]}" value="${this.params[key]}"></label>`).join('')}</section><section><h3>PALETTE</h3>${(['color', 'neon'] as const).map(key => `<label class="color-row">${labels[key]}<input aria-label="${labels[key]}" data-color="${key}" type="color" value="${this.params[key]}"></label>`).join('')}</section><p class="param-note">Dimensions en multiplicateurs. Les dimensions fonctionnelles sont aussi utilisées par les collisions du jeu.</p>`;
    this.element('component-params').querySelectorAll<HTMLInputElement>('[data-param]').forEach(input => input.oninput = () => { const key = input.dataset.param as keyof typeof ranges; this.params[key] = Number(input.value); this.element(`value-${key}`).textContent = Number(input.value).toFixed(2); this.build(); this.markDirty(); });
    this.element('component-params').querySelectorAll<HTMLInputElement>('[data-color]').forEach(input => input.oninput = () => { this.params[input.dataset.color as 'color' | 'neon'] = input.value; this.build(); this.markDirty(); });
  }
  private setState(state: VisualState): void {
    this.state = state; this.elapsed = 0; this.component.setState(state); this.component.setAmount(this.amount);
    this.element('state-readout').textContent = state;
    this.element('state-buttons').querySelectorAll<HTMLButtonElement>('button').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.state === state)));
    if (this.kind === 'gate') this.frame();
  }
  private light(): void {
    const mode = (this.element('lighting') as HTMLSelectElement).value; const power = Number((this.element('light-power') as HTMLInputElement).value);
    this.scene.environment = mode === 'studio' ? this.environment.texture : null;
    this.key.intensity = mode === 'studio' ? 3 * power : 0; this.fill.intensity = mode === 'studio' ? 1.2 * power : 0; this.rim.intensity = mode === 'studio' ? 22 * power : 0;
    this.gameLighting.setIntensity(mode === 'game' ? power : 0);
  }
  private frame(): void {
    const openGate = this.kind === 'gate' && this.state === 'Activate';
    const factor = this.kind === 'flipper' ? 1.35 : ['rail', 'wall'].includes(this.kind) ? 0.95 : 1.65;
    const distance = Math.max(this.component.size.x, this.component.size.y, this.component.size.z, 1) * factor * (openGate ? 1.2 : 1);
    const targetY = openGate ? this.component.size.x * 0.3 : 0;
    const targetX = this.kind === 'flipper' ? this.component.size.x * 0.32 : 0;
    this.controls.target.set(targetX, targetY, 0); this.camera.position.set(distance * 0.8 + targetX, distance * 0.55 + targetY, distance); this.controls.update();
  }
  private resize(): void { const bounds = this.element('studio-viewport').getBoundingClientRect(); this.renderer.setSize(bounds.width, bounds.height); this.camera.aspect = bounds.width / Math.max(bounds.height, 1); this.camera.updateProjectionMatrix(); }
  private storeCurrent(): void { this.presets.components[this.kind] = { ...this.params }; }
  private status(message: string): void { this.element('preset-status').textContent = message; }
  private markDirty(): void { this.dirty = true; this.status('Modifications en aperçu — appliquer pour les retrouver dans le jeu et l’éditeur.'); }
  private update(time: number): void {
    const delta = Math.min((time - this.previous) / 1000, 0.05); this.previous = time; this.elapsed += delta;
    this.component.update(delta);
    if (this.state === 'Hit' && this.elapsed > 0.4) this.setState('Idle');
    this.controls.update(); this.renderer.render(this.scene, this.camera);
  }
  private dispose = (): void => {
    if (this.dirty) this.storeCurrent();
    this.renderer.setAnimationLoop(null); this.resizeObserver.disconnect(); this.controls.dispose(); this.component.dispose(); this.environment.dispose();
    this.stage.geometry.dispose(); (this.stage.material as THREE.Material).dispose(); this.gameLighting.dispose(); this.key.dispose(); this.fill.dispose(); this.rim.dispose(); this.renderer.dispose();
  };
}
