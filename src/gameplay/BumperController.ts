import Phaser from 'phaser';
import { PHYSICS } from '../config/physics';
import type { BumperDefinition } from '../tables/types';

export class BumperController {
  public readonly label: string;
  private readonly glow: Phaser.GameObjects.Arc;

  public constructor(
    private readonly scene: Phaser.Scene,
    public readonly definition: BumperDefinition,
  ) {
    this.label = `bumper:${definition.id}`;
    this.glow = scene.add.circle(definition.x, definition.y, definition.radius + 8, definition.color, 0.12)
      .setStrokeStyle(2, definition.color, 0.65).setDepth(2);
    scene.add.circle(definition.x, definition.y, definition.radius, 0x14212a)
      .setStrokeStyle(5, definition.color, 1).setDepth(2);
    scene.add.circle(definition.x, definition.y, definition.radius * 0.42, definition.color, 0.9).setDepth(2);

    scene.matter.add.circle(definition.x, definition.y, definition.radius, {
      isStatic: true,
      restitution: PHYSICS.bumper.restitution,
      label: this.label,
    });
  }

  public hit(ball: Phaser.Physics.Matter.Image): void {
    const direction = new Phaser.Math.Vector2(
      ball.x - this.definition.x,
      ball.y - this.definition.y,
    ).normalize();
    if (direction.lengthSq() === 0) direction.set(0, -1);
    ball.setVelocity(direction.x * PHYSICS.bumper.kickSpeed, direction.y * PHYSICS.bumper.kickSpeed);

    this.scene.tweens.killTweensOf(this.glow);
    this.glow.setAlpha(0.9).setScale(1.25);
    this.scene.tweens.add({ targets: this.glow, alpha: 0.12, scale: 1, duration: 180, ease: 'Quad.out' });
  }
}
