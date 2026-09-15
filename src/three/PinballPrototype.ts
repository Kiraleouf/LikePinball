import * as THREE from 'three';
import RAPIER from '@dimforge/rapier3d-compat';
import { CameraSectorState } from '../gameplay/CameraSectorState';

interface PhysicsMesh { readonly body: RAPIER.RigidBody; readonly mesh: THREE.Object3D }

const TILT = -0.11;
const CYAN = 0x35e7ff;
const MAGENTA = 0xff3bc8;
const GOLD = 0xffbd35;

export class PinballPrototype {
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(48, 1, 0.1, 100);
  private readonly renderer = new THREE.WebGLRenderer({ antialias: true });
  private readonly boardRotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(TILT, 0, 0));
  private readonly moving: PhysicsMesh[] = [];
  private readonly keys = new Set<string>();
  private world?: RAPIER.World;
  private ball?: RAPIER.RigidBody;
  private leftFlipper?: RAPIER.RigidBody;
  private rightFlipper?: RAPIER.RigidBody;
  private lastTime = performance.now();
  private readonly cameraSector = new CameraSectorState(3, 20, -10, 2);
  private readonly baseCameraPosition = new THREE.Vector3(0, 14, 21);
  private readonly baseCameraTarget = new THREE.Vector3(0, 0, 0);
  private readonly cameraTarget = new THREE.Vector3();
  private readonly cameraFrom = new THREE.Vector3();
  private readonly lookFrom = new THREE.Vector3();
  private readonly lookTo = new THREE.Vector3();
  private cameraTransition = 1;

  public constructor(private readonly root: HTMLElement) {
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.renderer.domElement.tabIndex = 0;
    root.append(this.renderer.domElement, this.createHud());
    this.resize();
  }

  public async start(): Promise<void> {
    await RAPIER.init();
    this.world = new RAPIER.World({ x: 0, y: -9.81, z: 0 });
    this.createScene();
    this.createPhysics();
    this.camera.position.copy(this.baseCameraPosition);
    this.cameraTarget.copy(this.baseCameraTarget);
    this.camera.lookAt(this.cameraTarget);
    this.bindControls();
    addEventListener('resize', () => this.resize());
    this.renderer.setAnimationLoop((time) => this.update(time));
  }

  private createScene(): void {
    this.scene.background = new THREE.Color(0x020508);
    this.scene.fog = new THREE.FogExp2(0x020508, 0.028);
    this.scene.add(new THREE.HemisphereLight(0x8bdcff, 0x05070b, 1.5));
    const key = new THREE.PointLight(CYAN, 55, 35, 2);
    key.position.set(-5, 9, 4);
    this.scene.add(key);
    const rim = new THREE.PointLight(MAGENTA, 45, 28, 2);
    rim.position.set(5, 5, -5);
    this.scene.add(rim);
  }

  private createPhysics(): void {
    const world = this.requireWorld();
    const boardMaterial = new THREE.MeshStandardMaterial({ color: 0x08131a, metalness: 0.55, roughness: 0.42 });
    for (let sector = 0; sector < 3; sector += 1) {
      const z = -sector * 20;
      this.addFixedBox(`plateau-${sector}`, new THREE.Vector3(0, -0.25, z), new THREE.Vector3(6, 0.25, 10), boardMaterial);
      const grid = new THREE.GridHelper(20, 20, CYAN, 0x123a44);
      grid.scale.x = 0.6; grid.position.copy(this.onBoard(0, z, 0.015)); grid.quaternion.copy(this.boardRotation); this.scene.add(grid);
      this.addFixedBox(`mur-gauche-${sector}`, new THREE.Vector3(-5.75, 0.42, z), new THREE.Vector3(0.18, 0.65, 10), this.neonMaterial(CYAN));
      this.addFixedBox(`mur-droit-${sector}`, new THREE.Vector3(5.75, 0.42, z), new THREE.Vector3(0.18, 0.65, 10), this.neonMaterial(CYAN));
    }
    const railMaterial = this.neonMaterial(CYAN);
    this.addFixedBox('mur-haut', new THREE.Vector3(0, 0.42, -49.75), new THREE.Vector3(5.8, 0.65, 0.18), railMaterial);
    [[-2.7, -3.2, MAGENTA], [2.7, -3.2, MAGENTA], [0, -0.5, GOLD]].forEach(([x, z, color], index) => {
      const position = this.onBoard(x, z, 0.62);
      const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(this.boardRotation));
      world.createCollider(RAPIER.ColliderDesc.cylinder(0.6, 0.8).setRestitution(1.15), body);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 0.8, 1.2, 32), this.neonMaterial(color));
      mesh.position.copy(position); mesh.quaternion.copy(this.boardRotation); mesh.name = `bumper-${index}`; this.scene.add(mesh);
    });
    this.leftFlipper = this.addFlipper('flipper-gauche', -2.15, 6.2, 0.18);
    this.rightFlipper = this.addFlipper('flipper-droit', 2.15, 6.2, -0.18);
    const ballPosition = this.onBoard(4.7, 7.7, 0.72);
    const ballBody = world.createRigidBody(RAPIER.RigidBodyDesc.dynamic()
      .setTranslation(ballPosition.x, ballPosition.y, ballPosition.z).setLinearDamping(0.16).setCcdEnabled(true));
    world.createCollider(RAPIER.ColliderDesc.ball(0.42).setRestitution(0.72).setFriction(0.08).setDensity(1.2), ballBody);
    const ballMesh = new THREE.Mesh(new THREE.SphereGeometry(0.42, 32, 24), new THREE.MeshPhysicalMaterial({
      color: 0xe8fbff, emissive: CYAN, emissiveIntensity: 0.35, metalness: 0.75, roughness: 0.16,
    }));
    this.scene.add(ballMesh); this.ball = ballBody; this.moving.push({ body: ballBody, mesh: ballMesh });
  }

  private addFixedBox(name: string, localPosition: THREE.Vector3, half: THREE.Vector3, material: THREE.Material): void {
    const world = this.requireWorld();
    const position = this.onBoard(localPosition.x, localPosition.z, localPosition.y);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.fixed().setTranslation(position.x, position.y, position.z).setRotation(this.boardRotation));
    world.createCollider(RAPIER.ColliderDesc.cuboid(half.x, half.y, half.z).setRestitution(0.45), body);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(half.x * 2, half.y * 2, half.z * 2), material);
    mesh.name = name; mesh.position.copy(position); mesh.quaternion.copy(this.boardRotation); this.scene.add(mesh);
  }

  private addFlipper(name: string, x: number, z: number, yaw: number): RAPIER.RigidBody {
    const world = this.requireWorld();
    const position = this.onBoard(x, z, 0.55);
    const rotation = this.flipperRotation(yaw);
    const body = world.createRigidBody(RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(position.x, position.y, position.z).setRotation(rotation));
    world.createCollider(RAPIER.ColliderDesc.cuboid(1.55, 0.24, 0.32).setRestitution(0.55).setFriction(0.05), body);
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(3.1, 0.48, 0.64), this.neonMaterial(CYAN));
    mesh.name = name; this.scene.add(mesh); this.moving.push({ body, mesh });
    return body;
  }

  private update(time: number): void {
    const world = this.world;
    if (!world) return;
    const delta = Math.min((time - this.lastTime) / 1_000, 1 / 30);
    world.timestep = delta;
    this.lastTime = time;
    this.setFlipperRotation(this.leftFlipper, this.keys.has('ArrowLeft') || this.keys.has('KeyQ') ? -0.62 : 0.18);
    this.setFlipperRotation(this.rightFlipper, this.keys.has('ArrowRight') || this.keys.has('KeyD') ? 0.62 : -0.18);
    world.step();
    for (const { body, mesh } of this.moving) {
      const position = body.translation(); const rotation = body.rotation();
      mesh.position.set(position.x, position.y, position.z); mesh.quaternion.set(rotation.x, rotation.y, rotation.z, rotation.w);
    }
    const ball = this.ball;
    if (ball) this.updateCamera(ball.translation().z, delta);
    if (ball && (ball.translation().y < -5 || ball.translation().z > 12)) this.resetBall();
    this.renderer.render(this.scene, this.camera);
  }

  private setFlipperRotation(body: RAPIER.RigidBody | undefined, yaw: number): void {
    body?.setNextKinematicRotation(this.flipperRotation(yaw));
  }

  private flipperRotation(yaw: number): THREE.Quaternion {
    return this.boardRotation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw));
  }

  private bindControls(): void {
    addEventListener('keydown', (event) => {
      this.keys.add(event.code);
      if (event.code === 'Space' && !event.repeat) this.launchBall();
    });
    addEventListener('keyup', (event) => this.keys.delete(event.code));
    this.renderer.domElement.focus();
  }

  private launchBall(): void {
    const impulse = new THREE.Vector3(0, 0, -18).applyQuaternion(this.boardRotation);
    this.ball?.applyImpulse(impulse, true);
  }

  private resetBall(): void {
    const position = this.onBoard(4.7, 7.7, 0.72);
    this.ball?.setTranslation(position, true); this.ball?.setLinvel({ x: 0, y: 0, z: 0 }, true); this.ball?.setAngvel({ x: 0, y: 0, z: 0 }, true);
  }

  private onBoard(x: number, z: number, height: number): THREE.Vector3 {
    return new THREE.Vector3(x, height, z).applyQuaternion(this.boardRotation);
  }

  private neonMaterial(color: number): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color: 0x101820, emissive: color, emissiveIntensity: 1.4, metalness: 0.45, roughness: 0.3 });
  }

  private createHud(): HTMLElement {
    const hud = document.createElement('section');
    hud.className = 'hud';
    hud.innerHTML = '<strong>LIKEPINBALL // 3D PROTOTYPE</strong><span>Q / ← &nbsp; FLIPPER GAUCHE</span><span>D / → &nbsp; FLIPPER DROIT</span><span>ESPACE &nbsp; LANCER</span>';
    return hud;
  }

  private resize(): void {
    const width = this.root.clientWidth; const height = this.root.clientHeight;
    this.camera.aspect = width / height; this.camera.updateProjectionMatrix(); this.renderer.setSize(width, height);
  }

  private updateCamera(ballZ: number, delta: number): void {
    const sector = this.cameraSector.update(ballZ);
    if (sector !== undefined) {
      const shift = this.onBoard(0, -sector * 20, 0);
      this.cameraFrom.copy(this.camera.position);
      this.lookFrom.copy(this.cameraTarget);
      this.lookTo.copy(this.baseCameraTarget).add(shift);
      this.cameraTransition = 0;
    }
    if (this.cameraTransition >= 1) return;
    this.cameraTransition = Math.min(1, this.cameraTransition + delta / 0.28);
    const eased = this.cameraTransition * this.cameraTransition * (3 - 2 * this.cameraTransition);
    const shift = this.onBoard(0, -this.cameraSector.currentSector * 20, 0);
    this.camera.position.lerpVectors(this.cameraFrom, this.baseCameraPosition.clone().add(shift), eased);
    this.cameraTarget.lerpVectors(this.lookFrom, this.lookTo, eased);
    this.camera.lookAt(this.cameraTarget);
  }

  private requireWorld(): RAPIER.World {
    if (!this.world) throw new Error('Monde Rapier non initialisé');
    return this.world;
  }
}
