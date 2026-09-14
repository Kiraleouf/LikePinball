import Phaser from 'phaser';
import { PHYSICS } from '../config/physics';
import type { Point } from '../tables/types';
import { MotionGuard } from '../physics/MotionGuard';

export class BallController {
  public readonly image: Phaser.Physics.Matter.Image;
  private leftLauncher = false;
  private launched = false;
  private readonly motionGuard = new MotionGuard();
  private readonly trail: Phaser.GameObjects.Arc[];

  public constructor(scene: Phaser.Scene, spawn: Point, texture: string) {
    this.image = scene.matter.add.image(spawn.x, spawn.y, texture);
    this.image.setCircle(PHYSICS.ball.radius);
    this.image.setBounce(PHYSICS.ball.restitution);
    this.image.setFriction(PHYSICS.ball.friction, 0, PHYSICS.ball.frictionAir);
    this.image.setDensity(PHYSICS.ball.density);
    this.image.setStatic(true);
    this.image.setData('kind', 'ball');
    this.image.setDepth(5);
    this.trail = Array.from({ length: 6 }, (_, index) => scene.add.circle(
      spawn.x, spawn.y, Math.max(2, PHYSICS.ball.radius - index * 2.4), 0x35e7ff, 0,
    ).setDepth(3));
  }

  public launch(): void {
    this.launched = true;
    this.image.setStatic(false);
    this.image.setVelocity(PHYSICS.launcher.velocity.x, PHYSICS.launcher.velocity.y);
  }

  public update(deltaMs: number): void {
    const body = this.image.body;
    if (!body) return;
    for (let index = this.trail.length - 1; index > 0; index -= 1) {
      this.trail[index].setPosition(this.trail[index - 1].x, this.trail[index - 1].y);
      this.trail[index].setAlpha(this.launched ? (this.trail.length - index) * 0.022 : 0);
    }
    this.trail[0].setPosition(this.image.x, this.image.y).setAlpha(this.launched ? 0.16 : 0);

    if (!this.leftLauncher && this.image.y < PHYSICS.launcher.exitHeight) {
      this.leftLauncher = true;
      this.image.setVelocity(PHYSICS.launcher.exitVelocityX, body.velocity.y);
    }

    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (
      this.launched &&
      this.image.y < PHYSICS.antiStall.maxY &&
      this.motionGuard.update(speed, deltaMs, PHYSICS.antiStall.speedThreshold, PHYSICS.antiStall.delayMs)
    ) {
      this.image.setVelocity(
        body.position.x < 360 ? PHYSICS.antiStall.nudgeVelocity.x : -PHYSICS.antiStall.nudgeVelocity.x,
        PHYSICS.antiStall.nudgeVelocity.y,
      );
      return;
    }
    if (speed <= PHYSICS.ball.maxSpeed) return;

    const scale = PHYSICS.ball.maxSpeed / speed;
    this.image.setVelocity(body.velocity.x * scale, body.velocity.y * scale);
  }

  public destroy(): void {
    this.trail.forEach((dot) => dot.destroy());
    this.image.destroy();
  }
}
