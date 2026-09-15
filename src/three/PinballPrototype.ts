import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CameraSectorState } from '../gameplay/CameraSectorState';
import { LaunchChargeState } from '../gameplay/LaunchChargeState';
import { RunState } from '../gameplay/RunState';
import { ScoreState } from '../gameplay/ScoreState';
import { SectorUnlockState } from '../gameplay/SectorUnlockState';
import { sectorUnlockScore, STARTING_BALLS } from '../config/game';
import { createRunSeed, generateSector, generateWorld } from '../tables';
import type { FlipperDefinition, Point, SectorDefinition, WallDefinition } from '../tables/types';

interface PhysicsMesh { readonly body: RAPIER.RigidBody; readonly mesh: THREE.Object3D }
interface Flipper3D { readonly body: RAPIER.RigidBody; readonly side: 'left' | 'right'; readonly rest: number; readonly active: number }

const TILT = 0.11;
const SECTOR_LENGTH = 20;
const CYAN = 0x35e7ff;
const GRAPHITE = 0x101820;

export class PinballPrototype {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 160);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly boardRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(TILT, 0, 0));
  private readonly moving: PhysicsMesh[] = [];
  private readonly flippers: Flipper3D[] = [];
  private readonly keys = new Set<string>();
  private readonly seed = createRunSeed();
  private readonly run = new RunState(STARTING_BALLS);
  private readonly score = new ScoreState();
  private readonly unlocks = new SectorUnlockState(sectorUnlockScore);
  private readonly charge = new LaunchChargeState(1_400);
  private readonly sectors = generateWorld(this.seed, 2).sectors;
  private readonly cameraSector = new CameraSectorState(this.sectors.length, SECTOR_LENGTH, -10, 2);
  private readonly bumperScores = new Map<number, number>();
  private readonly sectorGates = new Map<number, PhysicsMesh>();
  private eventQueue?: RAPIER.EventQueue;
  private world?: RAPIER.World;
  private ball?: RAPIER.RigidBody;
  private ballCollider?: RAPIER.Collider;
  private drainHandle?: number;
  private launcherGate?: RAPIER.RigidBody;
  private launcherExited = false;
  private ballLeftStart = false;
  private bestSector = 0;
  private lastTime = performance.now();
  private readonly baseCameraPosition = new THREE.Vector3(0, 14, 21);
  private readonly baseCameraTarget = new THREE.Vector3();
  private readonly cameraTarget = new THREE.Vector3();
  private readonly cameraFrom = new THREE.Vector3();
  private readonly lookFrom = new THREE.Vector3();
  private readonly lookTo = new THREE.Vector3();
  private cameraTransition = 1;

  public constructor(private readonly root: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.3;
    this.renderer.domElement.tabIndex = 0;
    root.append(this.renderer.domElement, this.createHud());
    this.resize();
  }

  public async start(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.eventQueue = new RAPIER.EventQueue(true);
    this.createScene();
    this.sectors.forEach((sector) => this.createSector(sector));
    this.createBase();
    this.createBall();
    this.camera.position.copy(this.baseCameraPosition);
    this.cameraTarget.copy(this.baseCameraTarget);
    this.camera.lookAt(this.cameraTarget);
    this.bindControls();
    this.updateHud();
    addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop((time) => this.update(time));
  }

  private createScene(): void {
    this.scene.background = new THREE.Color(0x020508);
    this.scene.fog = new THREE.FogExp2(0x020508, 0.018);
    this.scene.add(new THREE.HemisphereLight(0x8bdcff, 0x05070b, 1.5));
    const cyan = new THREE.PointLight(CYAN, 70, 45, 2); cyan.position.set(-6, 10, 5); this.scene.add(cyan);
    const pink = new THREE.PointLight(0xff3bc8, 55, 36, 2); pink.position.set(6, 7, -8); this.scene.add(pink);
  }

  private createSector(sector: SectorDefinition): void {
    const centerZ = -sector.id * SECTOR_LENGTH;
    this.addFixedBox(`plateau-${sector.id}`, 0, centerZ, -0.25, 6, 10, 0.25, GRAPHITE);
    const grid = new THREE.GridHelper(20, 20, CYAN, 0x123a44);
    grid.scale.x = 0.6; grid.position.copy(this.onBoard(0, centerZ, 0.015)); grid.quaternion.copy(this.boardRotation); this.scene.add(grid);
    this.addFixedBox(`mur-gauche-${sector.id}`, -5.75, centerZ, 0.42, 0.18, 10, 0.65, CYAN);
    this.addFixedBox(`mur-droit-${sector.id}`, 5.75, centerZ, 0.42, 0.18, 10, 0.65, CYAN);
    sector.bumpers.forEach((bumper) => this.addBumper(sector.id, bumper));
    sector.rails.forEach((rail) => rail.points.slice(1).forEach((point, index) =>
      this.addGuide(sector.id, rail.points[index], point, rail.thickness, rail.color)));
    sector.obstacles.forEach((obstacle, index) => this.addObstacle(sector.id, obstacle, index));
    sector.flippers.forEach((flipper) => this.addGeneratedFlipper(sector.id, flipper));
    this.addSectorGate(sector.id);
  }

  private createBase(): void {
    this.addFlipper('main-left', -2.15, 6.2, 'left', 0.18, -0.62);
    this.addFlipper('main-right', 2.15, 6.2, 'right', -0.18, 0.62);
    this.addFixedBox('couloir-interieur', 4.05, 3.7, 0.45, 0.12, 5.6, 0.62, CYAN);
    const world = this.requireWorld();
    const drainPosition = this.onBoard(0, 9.5, 0.25);
    const drainBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(drainPosition.x, drainPosition.y, drainPosition.z).setRotation(this.boardRotation));
    const drain = world.createCollider(RAPIER.ColliderDesc.cuboid(4.0, 0.5, 0.35).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), drainBody);
    this.drainHandle = drain.handle;
  }

  private createBall(): void {
    const world = this.requireWorld();
    const position = this.launchPosition();
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setCcdEnabled(true));
    const collider = world.createCollider(RAPIER.ColliderDesc.ball(0.42).setRestitution(0.72).setFriction(0.08)
      .setDensity(1.2).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), new THREE.MeshPhysicalMaterial({
      color: 0xe8fbff, emissive: CYAN, emissiveIntensity: 0.45, metalness: 0.75, roughness: 0.16,
    }));
    this.scene.add(mesh); this.moving.push({ body, mesh }); this.ball = body; this.ballCollider = collider;
  }

  private addBumper(sector: number, definition: { x: number; y: number; radius: number; score: number; color: number }): void {
    const world = this.requireWorld();
    const x = this.mapX(definition.x); const z = this.mapZ(sector, definition.y); const radius = definition.radius / 48;
    const position = this.onBoard(x, z, 0.62);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(this.boardRotation));
    const collider = world.createCollider(RAPIER.ColliderDesc.cylinder(0.6, radius).setRestitution(1.15)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
    this.bumperScores.set(collider.handle, definition.score);
    const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1.2, 32), this.neonMaterial(definition.color));
    mesh.position.copy(position); mesh.quaternion.copy(this.boardRotation); this.scene.add(mesh);
  }

  private addGuide(sector: number, from: Point, to: Point, thickness: number, color: number): void {
    const ax = this.mapX(from.x); const az = this.mapZ(sector, from.y); const bx = this.mapX(to.x); const bz = this.mapZ(sector, to.y);
    const dx = bx - ax; const dz = bz - az;
    this.addFixedBox('guide', (ax + bx) / 2, (az + bz) / 2, 0.32, Math.hypot(dx, dz) / 2, thickness / 100, 0.32, color, -Math.atan2(dz, dx));
  }

  private addObstacle(sector: number, obstacle: WallDefinition, index: number): void {
    this.addFixedBox(`obstacle-${sector}-${index}`, this.mapX(obstacle.x), this.mapZ(sector, obstacle.y), 0.36,
      obstacle.width / 90, obstacle.height / 80, 0.36, 0xffbd35, -(obstacle.angle ?? 0));
  }

  private addGeneratedFlipper(sector: number, definition: FlipperDefinition): void {
    this.addFlipper(definition.id, this.mapX(definition.x), this.mapZ(sector, definition.y), definition.side, definition.restAngle, definition.activeAngle);
  }

  private addFlipper(name: string, x: number, z: number, side: 'left' | 'right', rest: number, active: number): void {
    const world = this.requireWorld(); const position = this.onBoard(x, z, 0.55); const rotation = this.flipperRotation(rest);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z).setRotation(rotation));
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.25, 0.24, 0.3).setRestitution(0.6), body);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.48, 0.6), this.neonMaterial(CYAN)); mesh.name = name;
    this.scene.add(mesh); this.moving.push({ body, mesh }); this.flippers.push({ body, side, rest, active });
  }

  private addSectorGate(sector: number): void {
    const world = this.requireWorld(); const z = -10 - sector * SECTOR_LENGTH; const position = this.onBoard(0, z, 0.42);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(this.boardRotation));
    world.createCollider(RAPIER.ColliderDesc.cuboid(5.55, 0.55, 0.2).setRestitution(0.45), body);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(11.1, 1.1, 0.4), this.neonMaterial(0xffbd35));
    mesh.position.copy(position); mesh.quaternion.copy(this.boardRotation); mesh.name = `gate-${sector}`; this.scene.add(mesh);
    this.sectorGates.set(sector, { body, mesh });
  }

  private addFixedBox(name: string, x: number, z: number, height: number, halfX: number, halfZ: number, halfY: number, color: number, yaw = 0): void {
    const world = this.requireWorld(); const position = this.onBoard(x, z, height);
    const rotation = this.boardRotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(rotation));
    world.createCollider(RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ).setRestitution(0.45), body);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(halfX * 2, halfY * 2, halfZ * 2), this.neonMaterial(color));
    mesh.name = name; mesh.position.copy(position); mesh.quaternion.copy(rotation); this.scene.add(mesh);
  }

  private update(time: number): void {
    const world = this.world; if (!world) return;
    const delta = Math.min((time - this.lastTime) / 1_000, 1 / 30); this.lastTime = time; world.timestep = delta;
    this.charge.update(delta * 1_000);
    const left = this.keys.has('ArrowLeft') || this.keys.has('KeyQ'); const right = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    this.flippers.forEach((flipper) => flipper.body.setNextKinematicRotation(this.flipperRotation(
      (flipper.side === 'left' ? left : right) ? flipper.active : flipper.rest)));
    world.step(this.eventQueue); this.handleCollisions();
    for (const { body, mesh } of this.moving) { const p = body.translation(); const r = body.rotation(); mesh.position.set(p.x, p.y, p.z); mesh.quaternion.set(r.x, r.y, r.z, r.w); }
    if (this.ball) this.updateBall(delta);
    this.updateHud(); this.renderer.render(this.scene, this.camera);
  }

  private updateBall(delta: number): void {
    const ball = this.ball; if (!ball) return; const translation = ball.translation(); const local = this.toBoard(translation);
    this.updateCamera(local.z, delta);
    if (this.run.phase === 'playing' && local.z < 5.5) this.ballLeftStart = true;
    if (this.ballLeftStart && !this.launcherExited) this.closeLauncherGate();
    if (this.run.phase === 'playing' && !this.launcherExited && this.ballLeftStart && local.z > 7.1) this.prepareRetry();
    if (translation.y < -8 || local.z > 11) this.loseBall();
  }

  private handleCollisions(): void {
    const ballHandle = this.ballCollider?.handle; const eventQueue = this.eventQueue;
    if (ballHandle === undefined || !eventQueue) return;
    eventQueue.drainCollisionEvents((first, second, started) => {
      if (!started || (first !== ballHandle && second !== ballHandle)) return;
      const other = first === ballHandle ? second : first;
      if (other === this.drainHandle) { this.loseBall(); return; }
      const points = this.bumperScores.get(other);
      if (points) this.addScore(points);
    });
  }

  private addScore(points: number): void {
    const value = this.score.add(points);
    for (const gateIndex of this.unlocks.update(value)) {
      const gate = this.sectorGates.get(gateIndex);
      if (gate) {
        this.requireWorld().removeRigidBody(gate.body);
        this.scene.remove(gate.mesh);
        this.sectorGates.delete(gateIndex);
      }
      const nextId = gateIndex + 2;
      if (!this.sectors[nextId]) { const sector = generateSector(this.seed, nextId); this.sectors.push(sector); this.createSector(sector); this.cameraSector.setSectorCount(this.sectors.length); }
    }
  }

  private bindControls(): void {
    addEventListener('keydown', (event) => { this.keys.add(event.code); if (event.code === 'Space' && !event.repeat && this.run.phase === 'ready') this.charge.start(); });
    addEventListener('keyup', (event) => { this.keys.delete(event.code); if (event.code === 'Space') this.releaseLauncher(); });
    this.renderer.domElement.focus();
  }

  private releaseLauncher(): void {
    const power = this.charge.release(); if (power === undefined || !this.run.launch() || !this.ball) return;
    this.ball.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    this.ball.setTranslation(this.onBoard(3.45, 4.45, 0.72), true);
    const velocity = new THREE.Vector3(-4, 0, -18 - power * 25).applyQuaternion(this.boardRotation);
    this.ball.setLinvel(velocity, true); this.ballLeftStart = true; this.closeLauncherGate();
  }

  private closeLauncherGate(): void {
    const world = this.requireWorld(); const position = this.onBoard(4.65, 5.8, 0.45);
    this.launcherGate = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(this.boardRotation));
    world.createCollider(RAPIER.ColliderDesc.cuboid(0.75, 0.5, 0.18), this.launcherGate); this.launcherExited = true;
  }

  private prepareRetry(): void { this.run.retryLaunch(); this.resetBall(false); }

  private loseBall(): void {
    if (this.run.phase !== 'playing') return;
    this.run.loseBall();
    if (this.run.ballsRemaining === 0) { this.ball?.setBodyType(RAPIER.RigidBodyType.Fixed, true); return; }
    this.resetBall(true);
  }

  private resetBall(removeGate: boolean): void {
    if (removeGate && this.launcherGate) { this.requireWorld().removeRigidBody(this.launcherGate); this.launcherGate = undefined; }
    this.ball?.setBodyType(RAPIER.RigidBodyType.Fixed, true); this.ball?.setTranslation(this.launchPosition(), true);
    this.ball?.setLinvel({ x: 0, y: 0, z: 0 }, true); this.ball?.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.launcherExited = false; this.ballLeftStart = false; this.charge.reset();
  }

  private updateHud(): void {
    this.setText('score', `SCORE ${this.score.value.toLocaleString('fr-FR')}`);
    this.setText('sector', `SECTEUR ${this.cameraSector.currentSector} · RECORD ${this.bestSector}`);
    this.setText('target', `PROCHAIN ${this.unlocks.nextThreshold.toLocaleString('fr-FR')}`);
    this.setText('balls', `BILLES ${this.run.ballsRemaining}`);
    this.setText('charge', this.run.phase === 'ready' ? `PUISSANCE ${Math.round(this.charge.value * 100)}%` : this.run.phase === 'game-over' ? 'GAME OVER' : 'EN JEU');
  }

  private updateCamera(ballZ: number, delta: number): void {
    const sector = this.cameraSector.update(ballZ);
    if (sector !== undefined) { this.bestSector = Math.max(this.bestSector, sector); const shift = this.onBoard(0, -sector * SECTOR_LENGTH, 0); this.cameraFrom.copy(this.camera.position); this.lookFrom.copy(this.cameraTarget); this.lookTo.copy(this.baseCameraTarget).add(shift); this.cameraTransition = 0; }
    if (this.cameraTransition >= 1) return;
    this.cameraTransition = Math.min(1, this.cameraTransition + delta / 0.28); const t = this.cameraTransition; const eased = t * t * (3 - 2 * t);
    const shift = this.onBoard(0, -this.cameraSector.currentSector * SECTOR_LENGTH, 0);
    this.camera.position.lerpVectors(this.cameraFrom, this.baseCameraPosition.clone().add(shift), eased); this.cameraTarget.lerpVectors(this.lookFrom, this.lookTo, eased); this.camera.lookAt(this.cameraTarget);
  }

  private createHud(): HTMLElement {
    const hud = document.createElement('section'); hud.className = 'hud';
    hud.innerHTML = `<strong>LIKEPINBALL // 3D</strong><span id="score"></span><span id="sector"></span><span id="target"></span><span id="balls"></span><span id="charge"></span><small>SEED ${this.seed}</small><span>Q/← · D/→ · ESPACE</span>`;
    return hud;
  }

  private setText(id: string, value: string): void { const element = document.getElementById(id); if (element) element.textContent = value; }
  private launchPosition(): THREE.Vector3 { return this.onBoard(4.75, 7.7, 0.72); }
  private mapX(x: number): number { return (x - 360) / 45; }
  private mapZ(sector: number, y: number): number { return (y - 540) / 50 - sector * SECTOR_LENGTH; }
  private onBoard(x: number, z: number, height: number): THREE.Vector3 { return new THREE.Vector3(x, height, z).applyQuaternion(this.boardRotation); }
  private toBoard(position: RAPIER.Vector): THREE.Vector3 { return new THREE.Vector3(position.x, position.y, position.z).applyQuaternion(this.boardRotation.clone().invert()); }
  private flipperRotation(yaw: number): THREE.Quaternion { return this.boardRotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw)); }
  private neonMaterial(color: number): THREE.MeshStandardMaterial { return new THREE.MeshStandardMaterial({ color: GRAPHITE, emissive: color, emissiveIntensity: 1.4, metalness: 0.45, roughness: 0.3 }); }
  private resize(): void { const width = this.root.clientWidth; const height = this.root.clientHeight; this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height); }
  private requireWorld(): RAPIER.World { if (!this.world) throw new Error('Monde Rapier non initialisé'); return this.world; }
}
