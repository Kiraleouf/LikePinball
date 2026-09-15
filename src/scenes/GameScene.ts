import Phaser from 'phaser';
import { CAMERA, sectorUnlockScore, STARTING_BALLS } from '../config/game';
import { PHYSICS } from '../config/physics';
import { BallController } from '../gameplay/BallController';
import { BumperController } from '../gameplay/BumperController';
import { FlipperController } from '../gameplay/FlipperController';
import { RunState } from '../gameplay/RunState';
import { ScoreState } from '../gameplay/ScoreState';
import { LauncherGateController } from '../gameplay/LauncherGateController';
import { LaunchChargeState } from '../gameplay/LaunchChargeState';
import { SectorGateController } from '../gameplay/SectorGateController';
import { SectorUnlockState } from '../gameplay/SectorUnlockState';
import { CameraSectorState } from '../gameplay/CameraSectorState';
import { TableRenderer } from '../rendering/TableRenderer';
import { LaunchGauge } from '../rendering/LaunchGauge';
import { createRailSegments } from '../physics/railGeometry';
import { createRunSeed, generateSector, generateWorld, worldY } from '../tables';
import type { WorldDefinition } from '../tables/types';

export class GameScene extends Phaser.Scene {
  private ball?: BallController;
  private readonly flippers = new Map<string, FlipperController>();
  private leftKeys: Phaser.Input.Keyboard.Key[] = [];
  private rightKeys: Phaser.Input.Keyboard.Key[] = [];
  private leftTapUntil = 0;
  private rightTapUntil = 0;
  private run = new RunState(STARTING_BALLS);
  private score = new ScoreState();
  private readonly bumpers = new Map<string, BumperController>();
  private ballsText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private stateText?: Phaser.GameObjects.Text;
  private launcherGate?: LauncherGateController;
  private readonly launchCharge = new LaunchChargeState(PHYSICS.launcher.chargeCycleMs);
  private launchGauge?: LaunchGauge;
  private sectorGates?: SectorGateController;
  private sectorText?: Phaser.GameObjects.Text;
  private sectorUnlocks = new SectorUnlockState(sectorUnlockScore);
  private seed = 'initial';
  private world: WorldDefinition = generateWorld(this.seed);
  private cameraSector = new CameraSectorState(this.world.sectors.length, CAMERA.sectorHeight, CAMERA.seamY, CAMERA.engagement);
  private bestSector = 0;
  private tableRenderer?: TableRenderer;
  private flipperTexture = '';

  public constructor() {
    super('game');
  }

  public init(): void {
    this.run = new RunState(STARTING_BALLS);
    this.score = new ScoreState();
    this.sectorUnlocks = new SectorUnlockState(sectorUnlockScore);
    this.seed = createRunSeed();
    this.world = generateWorld(this.seed);
    this.cameraSector = new CameraSectorState(this.world.sectors.length, CAMERA.sectorHeight, CAMERA.seamY, CAMERA.engagement);
    this.bestSector = 0;
    this.bumpers.clear();
    this.flippers.clear();
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(this.world.backgroundColor);
    const highestPreparedY = this.world.sectors[this.world.sectors.length - 1].offsetY;
    this.cameras.main.setBounds(0, highestPreparedY, 720, 1_080 - highestPreparedY).setScroll(0, 0);
    const renderer = new TableRenderer(this, this.world);
    this.tableRenderer = renderer;
    renderer.draw();
    this.createPhysics();
    this.sectorGates = new SectorGateController(this, this.world.sectors);
    this.launcherGate = new LauncherGateController(this);
    this.createBumpers();
    const flipperTexture = renderer.createFlipperTexture();
    this.flipperTexture = flipperTexture;
    this.createFlippers(flipperTexture);
    this.prepareBall(renderer.createBallTexture());
    this.createControls();
    this.createHud();
    this.launchGauge = new LaunchGauge(this);

    const matterWorld = this.matter.world;
    matterWorld.on('collisionstart', this.handleCollision, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      matterWorld.off('collisionstart', this.handleCollision, this);
    });
  }

  public update(time: number, delta: number): void {
    this.ball?.update(delta);
    if (this.ball) {
      const sector = this.cameraSector.update(this.ball.image.y);
      if (sector !== undefined) {
        this.bestSector = Math.max(this.bestSector, sector);
        this.sectorText?.setText(this.sectorProgressLabel());
        this.transitionCameraTo(sector);
      }
    }
    if (this.ball?.canRetryLaunch && this.run.retryLaunch()) {
      this.ball.resetForRetry();
      this.launchCharge.reset();
      this.launchGauge?.update(0);
      this.stateText?.setVisible(true);
    }
    this.launchCharge.update(delta);
    this.launchGauge?.update(this.launchCharge.value);
    if (this.ball?.hasExitedLauncher) this.launcherGate?.closeAfterExit(this.ball.image.x);
    const leftActive = this.leftKeys.some((key) => key.isDown) || time < this.leftTapUntil;
    const rightActive = this.rightKeys.some((key) => key.isDown) || time < this.rightTapUntil;
    for (const flipper of this.flippers.values()) flipper.update(flipper.side === 'left' ? leftActive : rightActive);

  }

  private createHud(): void {
    this.scoreText = this.add.text(108, 124, `SCORE  ${this.score.value.toLocaleString('fr-FR')}`, {
      color: '#35e7ff', fontFamily: 'monospace', fontSize: '22px', fontStyle: 'bold', letterSpacing: 2,
    }).setDepth(4).setScrollFactor(0);

    this.add.text(108, 92, 'MONDE VERTICAL', {
      color: '#e8fbff', fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold', letterSpacing: 3,
    }).setDepth(4).setScrollFactor(0);

    this.sectorText = this.add.text(108, 153, this.sectorProgressLabel(), {
      color: '#79aebb', fontFamily: 'monospace', fontSize: '12px', letterSpacing: 1,
    }).setDepth(4).setScrollFactor(0);
    this.add.text(108, 186, `SEED  ${this.seed}`, {
      color: '#406a74', fontFamily: 'monospace', fontSize: '10px', letterSpacing: 1,
    }).setDepth(4).setScrollFactor(0);

    this.ballsText = this.add.text(612, 92, `BILLES  ${this.run.ballsRemaining}`, {
      color: '#e8fbff', fontFamily: 'monospace', fontSize: '20px', fontStyle: 'bold', letterSpacing: 2,
    }).setOrigin(1, 0).setDepth(4).setScrollFactor(0);

    this.stateText = this.add.text(585, 865, 'MAINTENIR\nESPACE', {
      align: 'center', color: '#35e7ff', fontFamily: 'monospace', fontSize: '13px', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(4).setScrollFactor(0);

    this.add.text(360, 1020, '← / Q  GAUCHE     → / D  DROIT     ESPACE  CHARGER', {
      color: '#79aebb', fontFamily: 'monospace', fontSize: '12px', letterSpacing: 1,
    }).setOrigin(0.5).setDepth(4).setScrollFactor(0);
  }

  private createControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    this.game.canvas.tabIndex = 0;
    this.game.canvas.focus();
    this.leftKeys = [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q)];
    this.rightKeys = [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)];
    this.leftKeys.forEach((key) => key.on('down', () => {
      this.leftTapUntil = this.time.now + PHYSICS.flipper.tapHoldMs;
    }));
    this.rightKeys.forEach((key) => key.on('down', () => {
      this.rightTapUntil = this.time.now + PHYSICS.flipper.tapHoldMs;
    }));
    const launchKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    launchKey.on('down', () => {
      if (this.run.phase === 'ready') this.launchCharge.start();
    });
    launchKey.on('up', () => {
      const power = this.launchCharge.release();
      if (power === undefined || !this.run.launch()) return;
      this.ball?.launch(power);
      this.stateText?.setVisible(false);
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      [...this.leftKeys, ...this.rightKeys, launchKey].forEach((key) => key.removeAllListeners());
    });
  }

  private createPhysics(): void {
    this.world.sectors.forEach((sector) => this.createSectorPhysics(sector));
    this.matter.add.rectangle(this.world.drain.x, this.world.drain.y, this.world.drain.width, this.world.drain.height, {
      isStatic: true, isSensor: true, label: 'drain',
    });
    const post = this.world.safetyPost;
    this.matter.add.circle(post.x, post.y, post.radius, {
      isStatic: true,
      restitution: PHYSICS.safetyPost.restitution,
      friction: PHYSICS.safetyPost.friction,
      label: 'safety-post',
    });
  }

  private createSectorPhysics(sector: WorldDefinition['sectors'][number]): void {
      for (const wall of [...sector.walls, ...sector.obstacles]) {
        this.matter.add.rectangle(wall.x, worldY(wall.y, sector.offsetY), wall.width, wall.height, {
          isStatic: true, angle: wall.angle ?? 0, restitution: PHYSICS.wall.restitution,
          friction: PHYSICS.wall.friction, label: `wall:sector-${sector.id}`,
        });
      }
      for (const rail of sector.rails) {
        const worldRail = { ...rail, points: rail.points.map((point) => ({ x: point.x, y: worldY(point.y, sector.offsetY) })) };
        for (const segment of createRailSegments(worldRail)) {
          this.matter.add.rectangle(segment.x, segment.y, segment.width, segment.height, {
            isStatic: true, angle: segment.angle, restitution: PHYSICS.wall.restitution,
            friction: PHYSICS.wall.friction, label: `rail:${rail.id}`,
            chamfer: { radius: rail.thickness / 2 },
          });
        }
      }
  }

  private createBumpers(): void {
    this.world.sectors.forEach((sector) => this.createSectorBumpers(sector));
  }

  private createSectorBumpers(sector: WorldDefinition['sectors'][number]): void {
      for (const definition of sector.bumpers) {
        const bumper = new BumperController(this, { ...definition, y: worldY(definition.y, sector.offsetY) });
        this.bumpers.set(bumper.label, bumper);
      }
  }

  private createFlippers(texture: string): void {
    const main = [
      { id: 'main-left', side: 'left' as const, x: PHYSICS.flipper.left.pivot.x, y: PHYSICS.flipper.left.pivot.y, restAngle: PHYSICS.flipper.left.restAngle, activeAngle: PHYSICS.flipper.left.activeAngle },
      { id: 'main-right', side: 'right' as const, x: PHYSICS.flipper.right.pivot.x, y: PHYSICS.flipper.right.pivot.y, restAngle: PHYSICS.flipper.right.restAngle, activeAngle: PHYSICS.flipper.right.activeAngle },
    ];
    for (const definition of main) {
      const flipper = new FlipperController(this, definition, texture);
      this.flippers.set(flipper.label, flipper);
    }
    for (const sector of this.world.sectors) this.createSectorFlippers(sector, texture);
  }

  private createSectorFlippers(sector: WorldDefinition['sectors'][number], texture: string): void {
      for (const definition of sector.flippers) {
        const flipper = new FlipperController(this, { ...definition, y: worldY(definition.y, sector.offsetY) }, texture);
        this.flippers.set(flipper.label, flipper);
      }
  }

  private handleCollision(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    if (this.run.phase !== 'playing') return;
    this.handleFlipperHits(event);
    this.handleBumperHits(event);
    const drainHit = event.pairs.some(({ bodyA, bodyB }) => bodyA.label === 'drain' || bodyB.label === 'drain');
    if (!drainHit) return;

    this.ball?.destroy();
    this.ball = undefined;
    this.run.loseBall();
    this.ballsText?.setText(`BILLES  ${this.run.ballsRemaining}`);
    this.game.events.emit('ball-lost');

    if (this.run.ballsRemaining === 0) {
      this.showGameOver();
      return;
    }
    this.time.delayedCall(650, () => this.prepareBall('ball'));
  }

  private handleBumperHits(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    if (!this.ball) return;
    const ballBody = this.ball.image.body;
    if (!ballBody) return;

    for (const { bodyA, bodyB } of event.pairs) {
      const other = bodyA === ballBody ? bodyB : bodyB === ballBody ? bodyA : undefined;
      if (!other) continue;
      const bumper = this.bumpers.get(other.label);
      if (!bumper) continue;

      bumper.hit(this.ball.image);
      const value = this.score.add(bumper.definition.score);
      this.scoreText?.setText(`SCORE  ${value.toLocaleString('fr-FR')}`);
      for (const index of this.sectorUnlocks.update(value)) {
        this.sectorGates?.open(index, this);
        this.prepareSector(index + 2);
      }
      this.sectorText?.setText(this.sectorProgressLabel());
    }
  }

  private handleFlipperHits(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    if (!this.ball?.image.body) return;
    const ballBody = this.ball.image.body;
    for (const { bodyA, bodyB } of event.pairs) {
      const other = bodyA === ballBody ? bodyB : bodyB === ballBody ? bodyA : undefined;
      const flipper = other ? this.flippers.get(other.label) : undefined;
      flipper?.kick(this.ball.image);
    }
  }

  private prepareBall(texture: string): void {
    this.launcherGate?.openForLaunch();
    this.launchCharge.reset();
    this.launchGauge?.update(0);
    this.ball = new BallController(this, this.world.spawn, texture);
    this.stateText?.setVisible(true);
  }

  private showGameOver(): void {
    this.stateText?.setVisible(false);
    this.add.text(360, 530, 'GAME OVER', {
      color: '#e8fbff', fontFamily: 'monospace', fontSize: '42px', letterSpacing: 8,
    }).setOrigin(0.5).setDepth(5);
  }

  private sectorProgressLabel(): string {
    const next = this.sectorUnlocks.nextThreshold;
    return `SECTEUR ${this.cameraSector.currentSector}  RECORD ${this.bestSector}\nPROCHAIN ${next.toLocaleString('fr-FR')} PTS`;
  }

  private prepareSector(id: number): void {
    if (this.world.sectors[id]) return;
    const sector = generateSector(this.seed, id);
    this.world.sectors.push(sector);
    this.tableRenderer?.drawSector(sector);
    this.createSectorPhysics(sector);
    this.createSectorBumpers(sector);
    this.createSectorFlippers(sector, this.flipperTexture);
    this.sectorGates?.addGate(this, sector);
    this.cameraSector.setSectorCount(this.world.sectors.length);
    this.cameras.main.setBounds(0, sector.offsetY, 720, 1_080 - sector.offsetY);
  }

  private transitionCameraTo(sector: number): void {
    this.tweens.add({
      targets: this.cameras.main,
      scrollY: -sector * CAMERA.sectorHeight,
      duration: CAMERA.transitionMs,
      ease: 'Sine.easeInOut',
    });
  }

}
