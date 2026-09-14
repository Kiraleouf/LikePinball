import Phaser from 'phaser';
import { PHYSICS } from '../config/physics';
import type { Point } from '../tables/types';

export class BallController {
  public readonly image: Phaser.Physics.Matter.Image;

  public constructor(scene: Phaser.Scene, spawn: Point, texture: string) {
    this.image = scene.matter.add.image(spawn.x, spawn.y, texture);
    this.image.setCircle(PHYSICS.ball.radius);
    this.image.setBounce(PHYSICS.ball.restitution);
    this.image.setFriction(PHYSICS.ball.friction, 0, PHYSICS.ball.frictionAir);
    this.image.setDensity(PHYSICS.ball.density);
    this.image.setVelocity(PHYSICS.ball.initialVelocity.x, PHYSICS.ball.initialVelocity.y);
    this.image.setData('kind', 'ball');
  }

  public limitSpeed(): void {
    const body = this.image.body;
    if (!body) return;

    const speed = Math.hypot(body.velocity.x, body.velocity.y);
    if (speed <= PHYSICS.ball.maxSpeed) return;

    const scale = PHYSICS.ball.maxSpeed / speed;
    this.image.setVelocity(body.velocity.x * scale, body.velocity.y * scale);
  }
}
