import Phaser from 'phaser';
import { STARTING_BALLS } from '../config/game';
import { PHYSICS } from '../config/physics';
import { BallController } from '../gameplay/BallController';
import { BumperController } from '../gameplay/BumperController';
import { FlipperController } from '../gameplay/FlipperController';
import { RunState } from '../gameplay/RunState';
import { ScoreState } from '../gameplay/ScoreState';
import { TableRenderer } from '../rendering/TableRenderer';
import { TABLE_ZERO } from '../tables/table0';

export class GameScene extends Phaser.Scene {
  private ball?: BallController;
  private leftFlipper?: FlipperController;
  private rightFlipper?: FlipperController;
  private leftKeys: Phaser.Input.Keyboard.Key[] = [];
  private rightKeys: Phaser.Input.Keyboard.Key[] = [];
  private launchKey?: Phaser.Input.Keyboard.Key;
  private readonly run = new RunState(STARTING_BALLS);
  private readonly score = new ScoreState();
  private readonly bumpers = new Map<string, BumperController>();
  private ballsText?: Phaser.GameObjects.Text;
  private scoreText?: Phaser.GameObjects.Text;
  private stateText?: Phaser.GameObjects.Text;

  public constructor() {
    super('game');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(TABLE_ZERO.backgroundColor);
    const renderer = new TableRenderer(this, TABLE_ZERO);
    renderer.draw();
    this.createPhysics();
    this.createBumpers();
    const flipperTexture = renderer.createFlipperTexture();
    this.leftFlipper = new FlipperController(this, 'left', flipperTexture);
    this.rightFlipper = new FlipperController(this, 'right', flipperTexture);
    this.prepareBall(renderer.createBallTexture());
    this.createControls();
    this.createHud();

    this.matter.world.on('collisionstart', this.handleCollision, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.matter.world.off('collisionstart', this.handleCollision, this);
    });
  }

  public update(): void {
    this.ball?.limitSpeed();
    this.leftFlipper?.update(this.leftKeys.some((key) => key.isDown));
    this.rightFlipper?.update(this.rightKeys.some((key) => key.isDown));

  }

  private createHud(): void {
    this.scoreText = this.add.text(108, 124, 'SCORE  0', {
      color: '#35e7ff', fontFamily: 'monospace', fontSize: '18px', letterSpacing: 2,
    }).setDepth(4);

    this.add.text(108, 92, 'PLATEAU 0', {
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
    for (const wall of TABLE_ZERO.walls) {
      this.matter.add.rectangle(wall.x, wall.y, wall.width, wall.height, {
        isStatic: true, angle: wall.angle ?? 0, restitution: PHYSICS.wall.restitution,
        friction: PHYSICS.wall.friction, label: 'wall',
      });
    }
    this.matter.add.rectangle(TABLE_ZERO.drain.x, TABLE_ZERO.drain.y, TABLE_ZERO.drain.width, TABLE_ZERO.drain.height, {
      isStatic: true, isSensor: true, label: 'drain',
    });
  }

  private createBumpers(): void {
    for (const definition of TABLE_ZERO.bumpers) {
      const bumper = new BumperController(this, definition);
      this.bumpers.set(bumper.label, bumper);
    }
  }

  private handleCollision(event: Phaser.Physics.Matter.Events.CollisionStartEvent): void {
    if (this.run.phase !== 'playing') return;
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
      this.scoreText?.setText(`SCORE  ${this.score.add(bumper.definition.score).toLocaleString('fr-FR')}`);
    }
  }

  private prepareBall(texture: string): void {
    this.ball = new BallController(this, TABLE_ZERO.spawn, texture);
    this.stateText?.setVisible(true);
  }

  private showGameOver(): void {
    this.stateText?.setVisible(false);
    this.add.text(360, 530, 'GAME OVER', {
      color: '#e8fbff', fontFamily: 'monospace', fontSize: '42px', letterSpacing: 8,
    }).setOrigin(0.5).setDepth(5);
  }
}
