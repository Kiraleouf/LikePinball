import Phaser from 'phaser';
import { PHYSICS } from '../config/physics';
import { BallController } from '../gameplay/BallController';
import { TableRenderer } from '../rendering/TableRenderer';
import { TABLE_ZERO } from '../tables/table0';

export class GameScene extends Phaser.Scene {
  private ball?: BallController;
  private lost = false;

  public constructor() {
    super('game');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(TABLE_ZERO.backgroundColor);

    const renderer = new TableRenderer(this, TABLE_ZERO);
    renderer.draw();
    this.createPhysics();
    this.ball = new BallController(this, TABLE_ZERO.spawn, renderer.createBallTexture());

    this.add
      .text(108, 92, 'PLATEAU 0  ·  TEST PHYSIQUE', {
        color: '#e8fbff',
        fontFamily: 'monospace',
        fontSize: '18px',
        letterSpacing: 3,
      })
      .setDepth(2);

    this.matter.world.on('collisionstart', this.handleCollision, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.matter.world.off('collisionstart', this.handleCollision, this);
    });
  }

  public update(): void {
    this.ball?.limitSpeed();
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
