import Phaser from 'phaser';
import { STARTING_BALLS } from '../config/game';
import { PHYSICS } from '../config/physics';
import { BallController } from '../gameplay/BallController';
import { BumperController } from '../gameplay/BumperController';
import { FlipperController } from '../gameplay/FlipperController';
import { RunState } from '../gameplay/RunState';
import { ScoreState } from '../gameplay/ScoreState';
import { ProgressionState } from '../gameplay/ProgressionState';
import { PortalController } from '../gameplay/PortalController';
import { TableRenderer } from '../rendering/TableRenderer';
import { createRailSegments } from '../physics/railGeometry';
import { getTable } from '../tables';
import type { TableDefinition } from '../tables/types';

interface SceneData {
  readonly tableId?: number;
  readonly ballsRemaining?: number;
  readonly score?: number;
}

export class GameScene extends Phaser.Scene {
  private ball?: BallController;
  private leftFlipper?: FlipperController;
  private rightFlipper?: FlipperController;
  private leftKeys: Phaser.Input.Keyboard.Key[] = [];
  private rightKeys: Phaser.Input.Keyboard.Key[] = [];
  private launchKey?: Phaser.Input.Keyboard.Key;
  private table: TableDefinition = getTable(0);
  private run = new RunState(STARTING_BALLS);
  private score = new ScoreState();
  private progression = new ProgressionState(this.table.targetScore);
  private readonly bumpers = new Map<string, BumperController>();
  private ballsText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private stateText?: Phaser.GameObjects.Text;
  private progressFill?: Phaser.GameObjects.Rectangle;
  private portal?: PortalController;
  private transitioning = false;

  public constructor() {
    super('game');
  }

  public init(data: SceneData): void {
    this.table = getTable(data.tableId ?? 0);
    this.run = new RunState(data.ballsRemaining ?? STARTING_BALLS);
    this.score = new ScoreState(data.score ?? 0);
    this.progression = new ProgressionState(this.table.targetScore);
    this.bumpers.clear();
    this.transitioning = false;
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(this.table.backgroundColor);
    const renderer = new TableRenderer(this, this.table);
    renderer.draw();
    this.createPhysics();
    this.createBumpers();
    this.portal = new PortalController(this, this.table.portal);
    const flipperTexture = renderer.createFlipperTexture();
    this.leftFlipper = new FlipperController(this, 'left', flipperTexture);
    this.rightFlipper = new FlipperController(this, 'right', flipperTexture);
    this.prepareBall(renderer.createBallTexture());
    this.createControls();
    this.createHud();

    if (this.table.id > 0) this.showTableArrival();

    this.matter.world.on('collisionstart', this.handleCollision, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.matter.world.off('collisionstart', this.handleCollision, this);
    });
  }

  public update(_time: number, delta: number): void {
    this.ball?.update(delta);
    this.leftFlipper?.update(this.leftKeys.some((key) => key.isDown));
    this.rightFlipper?.update(this.rightKeys.some((key) => key.isDown));

  }

  private createHud(): void {
    this.scoreText = this.add.text(108, 124, `SCORE  ${this.score.value.toLocaleString('fr-FR')}`, {
      color: '#35e7ff', fontFamily: 'monospace', fontSize: '18px', letterSpacing: 2,
    }).setDepth(4);

    this.add.text(108, 153, `OBJECTIF  ${this.table.targetScore.toLocaleString('fr-FR')}`, {
      color: '#79aebb', fontFamily: 'monospace', fontSize: '12px', letterSpacing: 1,
    }).setDepth(4);
    this.add.rectangle(108, 177, 190, 5, 0x123a44).setOrigin(0, 0.5).setDepth(4);
    this.progressFill = this.add.rectangle(108, 177, 190, 5, 0x35e7ff).setOrigin(0, 0.5)
      .setScale(this.progression.ratio(this.score.value), 1).setDepth(5);

    this.add.text(108, 92, this.table.name.toUpperCase(), {
      color: '#e8fbff', fontFamily: 'monospace', fontSize: '18px', letterSpacing: 3,
    }).setDepth(4);

    this.ballsText = this.add.text(612, 92, `BILLES  ${this.run.ballsRemaining}`, {
      color: '#e8fbff', fontFamily: 'monospace', fontSize: '18px', letterSpacing: 2,
    }).setOrigin(1, 0).setDepth(4);

    this.stateText = this.add.text(585, 865, 'ESPACE\nLANCER', {
      align: 'center', color: '#35e7ff', fontFamily: 'monospace', fontSize: '13px', letterSpacing: 2,
    }).setOrigin(0.5).setDepth(4);

    this.add.text(360, 1020, '← / Q  GAUCHE     → / D  DROIT     ESPACE  LANCER', {
      color: '#79aebb', fontFamily: 'monospace', fontSize: '12px', letterSpacing: 1,
    }).setOrigin(0.5).setDepth(4);
  }

  private createControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;
    this.game.canvas.tabIndex = 0;
    this.game.canvas.focus();
    this.leftKeys = [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q)];
    this.rightKeys = [keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT), keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D)];
    this.launchKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
    this.launchKey.on('down', () => {
      if (!this.run.launch()) return;
      this.ball?.launch();
      this.stateText?.setVisible(false);
    });
  }

  private createPhysics(): void {
    for (const wall of this.table.walls) {
      this.matter.add.rectangle(wall.x, wall.y, wall.width, wall.height, {
        isStatic: true, angle: wall.angle ?? 0, restitution: PHYSICS.wall.restitution,
        friction: PHYSICS.wall.friction, label: 'wall',
      });
    }
    for (const rail of this.table.rails) {
      for (const segment of createRailSegments(rail)) {
        this.matter.add.rectangle(segment.x, segment.y, segment.width, segment.height, {
          isStatic: true, angle: segment.angle, restitution: PHYSICS.wall.restitution,
          friction: PHYSICS.wall.friction, label: `rail:${rail.id}`,
          chamfer: { radius: rail.thickness / 2 },
        });
      }
    }
    this.matter.add.rectangle(this.table.drain.x, this.table.drain.y, this.table.drain.width, this.table.drain.height, {
      isStatic: true, isSensor: true, label: 'drain',
    });
  }

  private createBumpers(): void {
    for (const definition of this.table.bumpers) {
      const bumper = new BumperController(this, definition);
      this.bumpers.set(bumper.label, bumper);
    }
  }

  private handleCollision(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    if (this.run.phase !== 'playing') return;
    this.handleBumperHits(event);
    const portalHit = event.pairs.some(({ bodyA, bodyB }) => bodyA.label === 'portal' || bodyB.label === 'portal');
    if (portalHit && this.progression.canEnterPortal('portal')) {
      this.beginTableTransition();
      return;
    }
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
      this.progressFill?.setScale(this.progression.ratio(value), 1);
      if (this.progression.update(value)) this.portal?.activate();
    }
  }

  private prepareBall(texture: string): void {
    this.ball = new BallController(this, this.table.spawn, texture);
    this.stateText?.setVisible(true);
  }

  private showGameOver(): void {
    this.stateText?.setVisible(false);
    this.add.text(360, 530, 'GAME OVER', {
      color: '#e8fbff', fontFamily: 'monospace', fontSize: '42px', letterSpacing: 8,
    }).setOrigin(0.5).setDepth(5);
  }

  private beginTableTransition(): void {
    if (this.transitioning) return;
    this.transitioning = true;
    this.ball?.image.setStatic(true);
    this.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, () => {
      this.scene.restart({
        tableId: this.table.id + 1,
        ballsRemaining: this.run.ballsRemaining,
        score: this.score.value,
      } satisfies SceneData);
    });
    this.cameras.main.fadeOut(450, 53, 231, 255);
  }

  private showTableArrival(): void {
    const label = this.add.text(360, 520, `${this.table.name.toUpperCase()}\nATTEINT`, {
      align: 'center', color: '#35e7ff', fontFamily: 'monospace', fontSize: '34px', letterSpacing: 6,
    }).setOrigin(0.5).setDepth(8);
    this.cameras.main.fadeIn(450, 2, 5, 8);
    this.tweens.add({ targets: label, alpha: 0, delay: 1_100, duration: 500 });
  }
}
