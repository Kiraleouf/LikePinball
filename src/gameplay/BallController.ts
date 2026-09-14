import Phaser from 'phaser';
import { PHYSICS } from '../config/physics';
import type { Point } from '../tables/types';

export class BallController {
  public readonly image: Phaser.Physics.Matter.Image;
  private leftLauncher = false;

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
    this.image.setStatic(false);
    this.image.setVelocity(PHYSICS.launcher.velocity.x, PHYSICS.launcher.velocity.y);
  }

  public limitSpeed(): void {
    const body = this.image.body;
    if (!body) return;

    if (!this.leftLauncher && this.image.y < PHYSICS.launcher.exitHeight) {
      this.leftLauncher = true;
      this.image.setVelocity(PHYSICS.launcher.exitVelocityX, body.velocity.y);
    }

    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed <= PHYSICS.ball.maxSpeed) return;

    const scale = PHYSICS.ball.maxSpeed / speed;
    this.image.setVelocity(body.velocity.x * scale, body.velocity.y * scale);
  }

  public destroy(): void {
    this.image.destroy();
  }
}
