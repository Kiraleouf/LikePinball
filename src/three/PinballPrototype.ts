import { bumperImpulse } from './bumperImpulse';
import { LAUNCHER, launcherStructure, rightBoundary, hasExitedLauncher } from './machine';
import { createGameLighting } from './components/lighting';
import { PHYSICS_3D, approachAngle, flipperYaw } from '../config/physics3d';
import { createComponent, readPresets, resolveParams, type Component3D, type ComponentKind, type ComponentOptions } from './components';
import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CameraSectorState } from '../gameplay/CameraSectorState';
import { LaunchChargeState } from '../gameplay/LaunchChargeState';
import { RunState } from '../gameplay/RunState';
import { ScoreState } from '../gameplay/ScoreState';
import { SectorUnlockState } from '../gameplay/SectorUnlockState';
import { sectorUnlockScore, STARTING_BALLS } from '../config/game';
import { parseTemplate } from '../editor/template';
import { createRunSeed, generateSector, generateWorld } from '../tables';
import { readTemplateCatalogue } from '../tables/templateCatalogue';
import type { FlipperDefinition, Point, PostDefinition, SectorDefinition, WallDefinition } from '../tables/types';

interface PhysicsMesh { readonly body: RAPIER.RigidBody; readonly mesh: THREE.Object3D; readonly visual?: Component3D }
interface Flipper3D { readonly body: RAPIER.RigidBody; readonly visual: Component3D; readonly side: 'left' | 'right'; readonly rest: number; readonly active: number; angle: number }

const TILT = PHYSICS_3D.tilt;
const SECTOR_LENGTH = 20;
const CYAN = 0x35e7ff;
const GRAPHITE = 0x101820;

export class PinballPrototype {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 160);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly boardRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(TILT, 0, 0));
  private readonly components: Component3D[] = [];
  private readonly visualPresets = readPresets();
  private readonly hitVisuals = new Map<number, Component3D>();
  private launcherVisual?: Component3D;
  private ballVisual?: Component3D;
  private readonly moving: PhysicsMesh[] = [];
  private readonly flippers: Flipper3D[] = [];
  private readonly keys = new Set<string>();
  private readonly seed = createRunSeed();
  private readonly run = new RunState(STARTING_BALLS);
  private readonly score = new ScoreState();
  private readonly unlocks = new SectorUnlockState(sectorUnlockScore);
  private readonly charge = new LaunchChargeState(1_400);
  private readonly templateCatalogue = readTemplateCatalogue();
  private readonly sectors = this.initialSectors();
  private readonly cameraSector = new CameraSectorState(this.sectors.length, SECTOR_LENGTH, -10, 2);
  private readonly bumpers = new Map<number, { score: number; center: THREE.Vector3; visual: Component3D; nextHitAt: number }>();
  private physicsTime = 0;
  private incomingSpeed = 0;
  private bumperHitCount = 0;
  private readonly physicsDebug = import.meta.env.DEV && new URLSearchParams(location.search).has('physics-debug');
  private readonly boardNormal = new THREE.Vector3(0, 1, 0).applyQuaternion(this.boardRotation);
  private readonly sectorGates = new Map<number, PhysicsMesh>();
  private eventQueue?: RAPIER.EventQueue;
  private world?: RAPIER.World;
  private ball?: RAPIER.RigidBody;
  private ballCollider?: RAPIER.Collider;
  private drainHandle?: number;
  private launcherGate?: RAPIER.RigidBody;
  private gateVisual?: Component3D;
  private launcherExited = false;
  private ballLeftStart = false;
  private bestSector = 0;
  private hasStarted = false;
  private gameOverShown = false;
  private lastTime = performance.now();
  private accumulator = 0;
  private readonly baseCameraPosition = new THREE.Vector3(0.8, 15.5, 23);
  private readonly baseCameraTarget = new THREE.Vector3(0.8, 0, 0);
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
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.domElement.tabIndex = 0;
    root.append(this.renderer.domElement, this.createHud());
    this.resize();
  }

  public async start(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -PHYSICS_3D.gravity, z: 0 });
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
    createGameLighting(this.scene);
  }

  private createSector(sector: SectorDefinition): void {
    const centerZ = -sector.id * SECTOR_LENGTH;
    this.addFixedBox(`plateau-${sector.id}`, 0, centerZ, -0.25, 6, 10, 0.25, GRAPHITE);
    const grid = new THREE.GridHelper(20, 20, CYAN, 0x123a44);
    grid.scale.x = 0.6; grid.position.copy(this.onBoard(0, centerZ, 0.015)); grid.quaternion.copy(this.boardRotation); this.scene.add(grid);
    this.addFixedBox(`mur-gauche-${sector.id}`, -5.75, centerZ, 0.42, 0.18, 10, 0.65, CYAN);
    const right = rightBoundary(sector.id);
    this.addFixedBox(`mur-droit-${sector.id}`, 5.75, right.z, 0.42, 0.18, right.length / 2, 0.65, CYAN);
    this.addPost(-5.25, centerZ - 9.25); this.addPost(5.25, centerZ - 9.25);
    this.addPost(-5.25, centerZ + 9.25); this.addPost(5.25, centerZ + 9.25);
    sector.bumpers.forEach((bumper) => this.addBumper(sector.id, bumper));
    sector.rails.forEach((rail) => rail.points.slice(1).forEach((point, index) =>
      this.addGuide(sector.id, rail.points[index], point, rail.thickness, rail.color)));
    sector.obstacles.forEach((obstacle, index) => this.addObstacle(sector.id, obstacle, index));
    sector.flippers.forEach((flipper) => this.addGeneratedFlipper(sector.id, flipper));
    sector.walls.forEach((wall) => this.addFixedBox('editable-wall', this.mapX(wall.x), this.mapZ(sector.id, wall.y), 0.36, wall.width / 90, wall.height / 100, 0.36, CYAN, -(wall.angle ?? 0)));
    sector.posts?.forEach((post) => this.addPlayablePost(sector.id, post));
    this.addSectorGate(sector.id);
  }

  private createBase(): void {
    launcherStructure().forEach(box => this.addFixedBox(box.name, box.x, box.z, box.y, box.width / 2, box.depth / 2, box.height / 2, CYAN, box.yaw));
    this.launcherVisual = this.component('launcher');
    const plunger = this.launcherVisual.root;
    plunger.position.copy(this.onBoard(LAUNCHER.x, LAUNCHER.plungerZ, 0.62)); plunger.quaternion.copy(this.boardRotation); this.scene.add(plunger);
    this.gateVisual = this.component('gate', { size: { x: LAUNCHER.gateLength, y: 1.5, z: 0.3 } });
    this.gateVisual.setState('Activate');
    this.gateVisual.root.position.copy(this.onBoard(LAUNCHER.gateX, LAUNCHER.gateZ, 0.6));
    this.gateVisual.root.quaternion.copy(this.launcherGateRotation());
    this.scene.add(this.gateVisual.root);
    const world = this.requireWorld();
    const drainPosition = this.onBoard(0, 9.5, 0.25);
    const drainBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(drainPosition.x, drainPosition.y, drainPosition.z).setRotation(this.boardRotation));
    const drain = world.createCollider(RAPIER.ColliderDesc.cuboid(5.5, 0.5, 0.35).setSensor(true).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), drainBody);
    this.drainHandle = drain.handle;
  }

  private createBall(): void {
    const world = this.requireWorld();
    this.ballVisual = this.component('ball');
    const position = this.launchPosition();
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setCcdEnabled(true).setLinearDamping(PHYSICS_3D.linearDamping));
    const collider = world.createCollider(this.collider(this.ballVisual).setRestitution(PHYSICS_3D.ballRestitution).setFriction(PHYSICS_3D.ballFriction)
      .setDensity(1.2).setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
    const mesh = this.ballVisual.root;
    mesh.castShadow = true; this.scene.add(mesh); this.moving.push({ body, mesh }); this.ball = body; this.ballCollider = collider;
  }

  private addBumper(sector: number, definition: { x: number; y: number; radius: number; score: number; color: number }): void {
    const world = this.requireWorld();
    const x = this.mapX(definition.x); const z = this.mapZ(sector, definition.y); const radius = definition.radius / 48;
    const position = this.onBoard(x, z, 0.62);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(this.boardRotation));
    const visual = this.component('bumper', { size: { x: radius * 2, y: 1.2, z: radius * 2 } });
    const collider = world.createCollider(this.collider(visual).setRestitution(PHYSICS_3D.bumperRestitution)
      .setActiveEvents(RAPIER.ActiveEvents.COLLISION_EVENTS), body);
    this.bumpers.set(collider.handle, { score: definition.score, center: position, visual, nextHitAt: 0 });
    const mesh = visual.root; this.hitVisuals.set(collider.handle, visual);
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
    const visual = this.component('flipper', { side, externalPose: true });
    const collider = world.createCollider(this.collider(visual).setRestitution(0.6), body); this.hitVisuals.set(collider.handle, visual);
    const mesh = visual.root; mesh.name = name;
    this.scene.add(mesh); this.moving.push({ body, mesh }); this.flippers.push({ body, visual, side, rest, active, angle: rest });
  }

  private addSectorGate(sector: number): void {
    const world = this.requireWorld(); const z = -10 - sector * SECTOR_LENGTH; const position = this.onBoard(0, z, 0.42);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(this.boardRotation));
    const visual = this.component('wall', { size: { x: 11.1, y: 1.1, z: 0.4 } });
    world.createCollider(this.collider(visual).setRestitution(0.45), body);
    const mesh = visual.root;
    mesh.position.copy(position); mesh.quaternion.copy(this.boardRotation); mesh.name = `gate-${sector}`; this.scene.add(mesh);
    this.sectorGates.set(sector, { body, mesh, visual });
  }

  private addFixedBox(name: string, x: number, z: number, height: number, halfX: number, halfZ: number, halfY: number, _color: number, yaw = 0): void {
    const world = this.requireWorld(); const position = this.onBoard(x, z, height);
    const rotation = this.boardRotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(rotation));
    const visual = name.startsWith('plateau-') ? undefined : this.component(name === 'guide' ? 'rail' : 'wall', { size: { x: halfX * 2, y: halfY * 2, z: halfZ * 2 } });
    const mesh = visual?.root ?? new THREE.Mesh(new THREE.BoxGeometry(halfX * 2, halfY * 2, halfZ * 2), new THREE.MeshStandardMaterial({ color: 0x071014, metalness: 0.25, roughness: 0.78 }));
    const collider = world.createCollider((visual ? this.collider(visual) : RAPIER.ColliderDesc.cuboid(halfX, halfY, halfZ)).setRestitution(0.45), body);
    if (visual) this.hitVisuals.set(collider.handle, visual);
    mesh.name = name; mesh.position.copy(position); mesh.quaternion.copy(rotation); mesh.castShadow = !name.startsWith('plateau-'); mesh.receiveShadow = true; this.scene.add(mesh);
  }

  private addPost(x: number, z: number): void {
    const post = this.component('post').root; post.position.copy(this.onBoard(x, z, 0.48)); post.quaternion.copy(this.boardRotation); this.scene.add(post);
  }

  private addPlayablePost(sector: number, definition: PostDefinition): void {
    const diameter = definition.radius * 2 / 45;
    const visual = this.component('post', { size: { x: diameter, y: 0.9, z: diameter } });
    const position = this.onBoard(this.mapX(definition.x), this.mapZ(sector, definition.y), 0.45);
    const body = this.requireWorld().createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(this.boardRotation));
    this.requireWorld().createCollider(this.collider(visual).setRestitution(0.7), body);
    visual.root.position.copy(position); visual.root.quaternion.copy(this.boardRotation); this.scene.add(visual.root);
  }

  private component(kind: ComponentKind, options: ComponentOptions = {}): Component3D {
    const visual = createComponent(kind, { ...options, params: options.params ?? resolveParams(kind, this.visualPresets) }); this.components.push(visual); return visual;
  }

  private collider(component: Component3D): RAPIER.ColliderDesc {
    const c = component.collider;
    if (c.type === 'ball') return RAPIER.ColliderDesc.ball(c.radius);
    if (c.type === 'cylinder') return RAPIER.ColliderDesc.cylinder(c.halfHeight, c.radius);
    if (c.type === 'convex') { const hull = RAPIER.ColliderDesc.convexHull(c.vertices); if (!hull) throw new Error('Géométrie convexe de flipper invalide'); return hull; }
    return RAPIER.ColliderDesc.cuboid(c.half.x, c.half.y, c.half.z);
  }

  private update(time: number): void {
    const world = this.world; if (!world) return;
    const delta = Math.min(Math.max(0, (time - this.lastTime) / 1_000), PHYSICS_3D.maxFrameTime); this.lastTime = time;
    this.charge.update(delta * 1_000);
    if (this.charge.active) this.launcherVisual?.setState('Activate');
    this.launcherVisual?.setAmount(this.charge.value);
    const left = this.keys.has('ArrowLeft') || this.keys.has('KeyQ'); const right = this.keys.has('ArrowRight') || this.keys.has('KeyD');
    this.accumulator += delta;
    while (this.accumulator >= PHYSICS_3D.timestep) {
      world.timestep = PHYSICS_3D.timestep;
      this.flippers.forEach(flipper => {
      const active = flipper.side === 'left' ? left : right;
      flipper.visual.setState(active ? 'Activate' : 'Idle');
      flipper.angle = approachAngle(flipper.angle, active ? flipper.active : flipper.rest, active ? PHYSICS_3D.flipperAngularSpeed : PHYSICS_3D.flipperReturnSpeed, PHYSICS_3D.timestep);
      flipper.body.setNextKinematicRotation(this.flipperRotation(flipper.angle));
    });
      this.physicsTime += PHYSICS_3D.timestep;
      if (this.physicsDebug && this.ball) { const v = this.ball.linvel(); this.incomingSpeed = Math.hypot(v.x, v.y, v.z); }
      world.step(this.eventQueue); this.handleCollisions(); this.updateLauncher();
      if (this.ball) { const velocity = this.ball.linvel(); const speed = Math.hypot(velocity.x, velocity.y, velocity.z); if (speed > PHYSICS_3D.maxBallSpeed) { const scale = PHYSICS_3D.maxBallSpeed / speed; this.ball.setLinvel({ x: velocity.x * scale, y: velocity.y * scale, z: velocity.z * scale }, true); } }
      this.accumulator -= PHYSICS_3D.timestep;
    }
    this.components.forEach(component => component.update(delta));
    for (const { body, mesh } of this.moving) { const p = body.translation(); const r = body.rotation(); mesh.position.set(p.x, p.y, p.z); mesh.quaternion.set(r.x, r.y, r.z, r.w); }
    if (this.ball) this.updateBall(delta);
    this.updateHud(); this.renderer.render(this.scene, this.camera);
  }

  private updateBall(delta: number): void {
    const ball = this.ball; if (!ball) return; const translation = ball.translation(); const local = this.toBoard(translation);
    this.updateCamera(local.z, delta);
    if (translation.y < -8 || local.z > 11) this.loseBall();
  }

  private handleCollisions(): void {
    const ballHandle = this.ballCollider?.handle; const eventQueue = this.eventQueue;
    if (ballHandle === undefined || !eventQueue) return;
    eventQueue.drainCollisionEvents((first, second, started) => {
      if (!started || (first !== ballHandle && second !== ballHandle)) return;
      const other = first === ballHandle ? second : first;
      if (other === this.drainHandle) { this.loseBall(); return; }
      this.ballVisual?.setState('Hit');
      const bumper = this.bumpers.get(other);
      if (!bumper) { this.hitVisuals.get(other)?.setState('Hit'); return; }
      if (!this.ball || this.run.phase !== 'playing' || this.physicsTime < bumper.nextHitAt) return;
      bumper.nextHitAt = this.physicsTime + PHYSICS_3D.bumperCooldown;
      this.ball.applyImpulse(bumperImpulse(this.ball.translation(), bumper.center, this.ball.linvel(), this.boardNormal, this.ball.mass()), true);
      bumper.visual.setState('Hit'); this.addScore(bumper.score);
      if (this.physicsDebug) {
        const v = this.ball.linvel(); const speed = Math.hypot(v.x, v.y, v.z);
        this.setText('physics-debug', `Bumper ${++this.bumperHitCount} · entrée ${this.incomingSpeed.toFixed(1)} → sortie ${speed.toFixed(1)} u/s`);
      }
    });
  }

  private addScore(points: number): void {
    const value = this.score.add(points);
    this.pulse('score-panel');
    for (const gateIndex of this.unlocks.update(value)) {
      this.pulse('progress-panel');
      const gate = this.sectorGates.get(gateIndex);
      if (gate) {
        this.requireWorld().removeRigidBody(gate.body);
        this.scene.remove(gate.mesh);
        if (gate.visual) { gate.visual.dispose(); const index = this.components.indexOf(gate.visual); if (index >= 0) this.components.splice(index, 1); }
        this.sectorGates.delete(gateIndex);
      }
      const nextId = gateIndex + 2;
      if (!this.sectors[nextId]) { const sector = generateSector(this.seed, nextId, this.templateCatalogue); this.sectors.push(sector); this.createSector(sector); this.cameraSector.setSectorCount(this.sectors.length); }
    }
  }

  private bindControls(): void {
    addEventListener('keydown', (event) => {
      if (!this.hasStarted && (event.code === 'Space' || event.code === 'Enter')) { this.startSession(); return; }
      if (this.run.phase === 'game-over' && event.code === 'KeyR') { location.reload(); return; }
      this.keys.add(event.code); if (event.code === 'Space' && !event.repeat && this.run.phase === 'ready') this.charge.start();
    });
    addEventListener('keyup', (event) => { this.keys.delete(event.code); if (event.code === 'Space') this.releaseLauncher(); });
    this.renderer.domElement.focus();
  }

  private releaseLauncher(): void {
    const power = this.charge.release(); if (power === undefined || !this.run.launch() || !this.ball) return;
    this.launcherVisual?.setState('Hit');
    this.ball.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    const velocity = new THREE.Vector3(0, 0, -PHYSICS_3D.launchMinSpeed - power * PHYSICS_3D.launchExtraSpeed).applyQuaternion(this.boardRotation);
    this.ball.setLinvel(velocity, true);
  }

  private launcherGateRotation(): THREE.Quaternion { return this.boardRotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2)); }
  private updateLauncher(): void {
    if (!this.ball || this.run.phase !== 'playing' || this.launcherExited) return;
    const local = this.toBoard(this.ball.translation());
    if (local.z < LAUNCHER.spawnZ - 0.5) this.ballLeftStart = true;
    if (hasExitedLauncher(local.x, local.z, (this.ballVisual?.size.x ?? 0.84) / 2)) this.closeLauncherGate();
    else if (this.ballLeftStart && local.z > LAUNCHER.retryZ) this.prepareRetry();
  }

  private closeLauncherGate(): void {
    const world = this.requireWorld(); const position = this.onBoard(LAUNCHER.gateX, LAUNCHER.gateZ, 0.6);
    this.launcherGate = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(this.launcherGateRotation()));
    if (this.gateVisual) { world.createCollider(this.collider(this.gateVisual), this.launcherGate); this.gateVisual.setState('Idle'); }
    this.launcherExited = true;
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
    if (removeGate) this.gateVisual?.setState('Activate');
    this.ball?.setBodyType(RAPIER.RigidBodyType.Fixed, true); this.ball?.setTranslation(this.launchPosition(), true);
    this.ball?.setLinvel({ x: 0, y: 0, z: 0 }, true); this.ball?.setAngvel({ x: 0, y: 0, z: 0 }, true);
    this.launcherExited = false; this.ballLeftStart = false; this.charge.reset();
  }

  private updateHud(): void {
    this.setText('score', this.score.value.toLocaleString('fr-FR'));
    this.setText('sector', `${this.cameraSector.currentSector + 1}`);
    this.setText('height', `${this.bestSector + 1}`);
    this.setText('target', this.unlocks.nextThreshold.toLocaleString('fr-FR'));
    this.setText('balls', `${this.run.ballsRemaining}`);
    this.setText('charge', this.run.phase === 'ready' ? 'PRÊT' : this.run.phase === 'game-over' ? 'TERMINÉE' : 'BILLE EN JEU');
    const previous = this.unlocks.highestAccessibleSector === 0 ? 0 : sectorUnlockScore(this.unlocks.highestAccessibleSector);
    const progress = Math.max(0, Math.min(1, (this.score.value - previous) / (this.unlocks.nextThreshold - previous)));
    document.getElementById('progress-fill')?.style.setProperty('--progress', `${progress * 100}%`);
    document.getElementById('power-fill')?.style.setProperty('--power', `${this.charge.value * 100}%`);
    if (this.run.phase === 'game-over' && !this.gameOverShown) this.showGameOver();
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
    const ui = document.createElement('section'); ui.className = 'game-ui';
    ui.innerHTML = `<aside class="hud" aria-label="Statistiques de la partie">
      <header><span class="brand-mark">LP</span><strong>LIKEPINBALL</strong><small>RUN ${this.seed}</small></header>
      <div class="score-panel" id="score-panel"><span>SCORE</span><strong id="score">0</strong></div>
      <div class="stats"><div><span>SECTEUR</span><strong id="sector">1</strong></div><div><span>RECORD</span><strong id="height">1</strong></div><div><span>BILLES</span><strong id="balls">3</strong></div></div>
      <div class="progress-panel" id="progress-panel"><div><span>PROCHAIN SECTEUR</span><strong id="target">10 000</strong></div><i><b id="progress-fill"></b></i></div>
      <div class="launcher-panel"><div><span>LANCEUR</span><strong id="charge">PRÊT</strong></div><i><b id="power-fill"></b></i></div>
      <footer><kbd>Q</kbd><kbd>←</kbd> GAUCHE <kbd>D</kbd><kbd>→</kbd> DROITE <kbd>ESPACE</kbd> LANCER</footer>
    </aside><div class="run-overlay" id="run-overlay"><div class="run-card"><span class="eyebrow">ASCENSION // 3D</span><h1>LIKE<span>PINBALL</span></h1><p>Monte, marque et ouvre la voie vers les secteurs supérieurs.</p><button id="start-run">LANCER LA RUN</button><small>ESPACE OU ENTRÉE</small></div></div>`;
    if (this.physicsDebug) { const output = document.createElement('output'); output.id = 'physics-debug'; output.style.cssText = 'position:absolute;bottom:12px;right:18px;color:#fff;background:#071014;padding:8px;font:12px monospace'; output.textContent = 'Diagnostic bumpers · en attente d’un impact'; ui.append(output); }
    const editorLink = document.createElement('a'); editorLink.className = 'editor-link'; editorLink.href = '/?editor=1'; editorLink.textContent = 'SECTOR LAB'; ui.append(editorLink);
    const showroomLink = document.createElement('a'); showroomLink.className = 'showroom-link'; showroomLink.href = '/?showroom=1'; showroomLink.textContent = 'COMPONENT STUDIO'; ui.append(showroomLink);
    ui.querySelector('#start-run')?.addEventListener('click', () => this.startSession());
    return ui;
  }

  private startSession(): void { this.hasStarted = true; document.getElementById('run-overlay')?.classList.add('is-hidden'); this.renderer.domElement.focus(); }

  private showGameOver(): void {
    this.gameOverShown = true; const overlay = document.getElementById('run-overlay'); if (!overlay) return;
    overlay.innerHTML = `<div class="run-card game-over"><span class="eyebrow">RUN TERMINÉE</span><h2>${this.score.value.toLocaleString('fr-FR')}</h2><p>Score final · Secteur record ${this.bestSector + 1}</p><button id="restart-run">REJOUER</button><small>TOUCHE R</small></div>`;
    overlay.classList.remove('is-hidden'); overlay.querySelector('#restart-run')?.addEventListener('click', () => location.reload());
  }

  private pulse(id: string): void { const element = document.getElementById(id); if (!element) return; element.classList.remove('pulse'); requestAnimationFrame(() => element.classList.add('pulse')); }

  private setText(id: string, value: string): void { const element = document.getElementById(id); if (element) element.textContent = value; }
  private initialSectors(): SectorDefinition[] {
    if (new URLSearchParams(location.search).has('editor-test')) {
      const source = localStorage.getItem('likepinball.editor-test');
      if (source) {
        try { return [{ ...parseTemplate(source).sector, id: 0, offsetY: 0 }, generateSector(this.seed, 1, this.templateCatalogue)]; }
        catch (error) { console.warn('Template éditeur ignoré', error); }
      }
    }
    return generateWorld(this.seed, 2, this.templateCatalogue).sectors;
  }
  private launchPosition(): THREE.Vector3 { return this.onBoard(LAUNCHER.x, LAUNCHER.spawnZ, (this.ballVisual?.size.y ?? 0.84) / 2 + 0.015); }
  private mapX(x: number): number { return (x - 360) / 45; }
  private mapZ(sector: number, y: number): number { return (y - 540) / 50 - sector * SECTOR_LENGTH; }
  private onBoard(x: number, z: number, height: number): THREE.Vector3 { return new THREE.Vector3(x, height, z).applyQuaternion(this.boardRotation); }
  private toBoard(position: RAPIER.Vector): THREE.Vector3 { return new THREE.Vector3(position.x, position.y, position.z).applyQuaternion(this.boardRotation.clone().invert()); }
  private flipperRotation(yaw: number): THREE.Quaternion { return this.boardRotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), flipperYaw(yaw))); }
  private resize(): void { const width = this.root.clientWidth; const height = this.root.clientHeight; this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height); }
  private requireWorld(): RAPIER.World { if (!this.world) throw new Error('Monde Rapier non initialisé'); return this.world; }
}
