import Phaser from 'phaser';
import { PHYSICS } from '../config/physics';
import type { FlipperDefinition } from '../tables/types';

export class FlipperController {
  public readonly image: Phaser.Physics.Matter.Image;
  public readonly side: 'left' | 'right';
  public readonly label: string;
  private active = false;

  public constructor(
    scene: Phaser.Scene,
    private readonly definition: FlipperDefinition,
    texture: string,
  ) {
    this.side = definition.side;
    this.label = `flipper:${definition.id}`;
    const direction = this.side === 'left' ? 1 : -1;
    const centerX = definition.x + direction * PHYSICS.flipper.width / 2;

    this.image = scene.matter.add.image(centerX, definition.y, texture);
    this.image.setRectangle(PHYSICS.flipper.width, PHYSICS.flipper.height, {
      chamfer: { radius: PHYSICS.flipper.height / 2 },
    });
    this.image.setBounce(0.25).setFriction(0.02).setDepth(3);
    this.image.setAngle(Phaser.Math.RadToDeg(definition.restAngle));
    this.image.setData('kind', this.label);

    const body = this.image.body;
    if (!body) throw new Error(`Corps Matter absent pour le flipper ${definition.id}`);
    (body as MatterJS.BodyType).label = this.label;

    scene.matter.add.worldConstraint(body as MatterJS.BodyType, 0, 0.95, {
      pointA: { x: definition.x, y: definition.y },
      pointB: {
        x: this.side === 'left' ? -PHYSICS.flipper.width / 2 : PHYSICS.flipper.width / 2,
        y: 0,
      },
      damping: 0.12,
    });
  }

  public update(active: boolean): void {
    this.active = active;
    const target = active ? this.definition.activeAngle : this.definition.restAngle;
    const current = this.image.rotation;
    const delta = target - current;
    const speed = active ? PHYSICS.flipper.angularSpeed : PHYSICS.flipper.returnSpeed;

    if (Math.abs(delta) <= speed) {
      this.image.setRotation(target).setAngularVelocity(0);
      return;
    }

    this.image.setAngularVelocity(Math.sign(delta) * speed);

    const minAngle = Math.min(this.definition.restAngle, this.definition.activeAngle);
    const maxAngle = Math.max(this.definition.restAngle, this.definition.activeAngle);
    if (current < minAngle || current > maxAngle) {
      this.image.setRotation(Phaser.Math.Clamp(current, minAngle, maxAngle));
    }
  }

  public kick(ball: Phaser.Physics.Matter.Image): boolean {
    if (!this.active) return false;
    const horizontal = this.sideDirection * PHYSICS.flipper.kickVelocityX;
    ball.setVelocity(horizontal, PHYSICS.flipper.kickVelocityY);
    return true;
  }

  private get sideDirection(): number {
    return this.side === 'left' ? 1 : -1;
  }
}
