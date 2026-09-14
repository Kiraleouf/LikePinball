import Phaser from 'phaser';
import { PHYSICS } from '../config/physics';
import type { Point } from '../tables/types';
import { MotionGuard } from '../physics/MotionGuard';

export class BallController {
  public readonly image: Phaser.Physics.Matter.Image;
  private leftLauncher = false;
  private launched = false;
  private readonly motionGuard = new MotionGuard();

  public constructor(scene: Phaser.Scene, spawn: Point, texture: string) {
    this.image = scene.matter.add.image(spawn.x, spawn.y, texture);
    this.image.setCircle(PHYSICS.ball.radius);
    this.image.setBounce(PHYSICS.ball.restitution);
    this.image.setFriction(PHYSICS.ball.friction, 0, PHYSICS.ball.frictionAir);
    this.image.setDensity(PHYSICS.ball.density);
    this.image.setStatic(true);
    this.image.setData('kind', 'ball');
  }

  public launch(): void {
    this.launched = true;
    this.image.setStatic(false);
    this.image.setVelocity(PHYSICS.launcher.velocity.x, PHYSICS.launcher.velocity.y);
  }

  public update(deltaMs: number): void {
    const body = this.image.body;
    if (!body) return;

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
    this.image.destroy();
  }
}
