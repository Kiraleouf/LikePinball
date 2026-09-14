import Phaser from 'phaser';
import { PHYSICS } from '../config/physics';
import { BallController } from '../gameplay/BallController';
import { FlipperController } from '../gameplay/FlipperController';
import { TableRenderer } from '../rendering/TableRenderer';
import { TABLE_ZERO } from '../tables/table0';

export class GameScene extends Phaser.Scene {
  private ball?: BallController;
  private leftFlipper?: FlipperController;
  private rightFlipper?: FlipperController;
  private leftKeys: Phaser.Input.Keyboard.Key[] = [];
  private rightKeys: Phaser.Input.Keyboard.Key[] = [];
  private lost = false;

  public constructor() {
    super('game');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(TABLE_ZERO.backgroundColor);

    const renderer = new TableRenderer(this, TABLE_ZERO);
    renderer.draw();
    this.createPhysics();
    const flipperTexture = renderer.createFlipperTexture();
    this.leftFlipper = new FlipperController(this, 'left', flipperTexture);
    this.rightFlipper = new FlipperController(this, 'right', flipperTexture);
    this.ball = new BallController(this, TABLE_ZERO.spawn, renderer.createBallTexture());
    this.createControls();

    this.add
      .text(108, 92, 'PLATEAU 0  ·  TEST PHYSIQUE', {
        color: '#e8fbff',
        fontFamily: 'monospace',
        fontSize: '18px',
        letterSpacing: 3,
      })
      .setDepth(2);

    this.add
      .text(360, 1020, '← / Q  GAUCHE     → / D  DROIT', {
        color: '#79aebb',
        fontFamily: 'monospace',
        fontSize: '14px',
        letterSpacing: 2,
      })
      .setOrigin(0.5)
      .setDepth(2);

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

  private createControls(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    this.leftKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
    ];
    this.rightKeys = [
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT),
      keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
    ];
  }

  private createPhysics(): void {
    for (const wall of TABLE_ZERO.walls) {
      this.matter.add.rectangle(wall.x, wall.y, wall.width, wall.height, {
        isStatic: true,
        angle: wall.angle ?? 0,
        restitution: PHYSICS.wall.restitution,
        friction: PHYSICS.wall.friction,
        label: 'wall',
      });
    }

    this.matter.add.rectangle(
      TABLE_ZERO.drain.x,
      TABLE_ZERO.drain.y,
      TABLE_ZERO.drain.width,
      TABLE_ZERO.drain.height,
      { isStatic: true, isSensor: true, label: 'drain' },
    );
  }

  private handleCollision(
    event: Phaser.Physics.Matter.Events.CollisionStartEvent,
  ): void {
    if (this.lost) return;

    const drainHit = event.pairs.some(
      ({ bodyA, bodyB }) => bodyA.label === 'drain' || bodyB.label === 'drain',
    );
    if (!drainHit) return;

    this.lost = true;
    this.ball?.image.setStatic(true).setVisible(false);
    this.add
      .text(360, 880, 'BILLE PERDUE', {
        color: '#35e7ff',
        fontFamily: 'monospace',
        fontSize: '22px',
        letterSpacing: 4,
      })
      .setOrigin(0.5);
    this.game.events.emit('ball-lost');
  }
}
