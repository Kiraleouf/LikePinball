import Phaser from 'phaser';
import { PHYSICS } from '../config/physics';

type FlipperSide = 'left' | 'right';

export class FlipperController {
  public readonly image: Phaser.Physics.Matter.Image;
  private readonly config: (typeof PHYSICS.flipper)[FlipperSide];

  public constructor(
    scene: Phaser.Scene,
    side: FlipperSide,
    texture: string,
  ) {
    this.config = PHYSICS.flipper[side];
    const direction = side === 'left' ? 1 : -1;
    const centerX = this.config.pivot.x + direction * PHYSICS.flipper.width / 2;

    this.image = scene.matter.add.image(centerX, this.config.pivot.y, texture);
    this.image.setRectangle(PHYSICS.flipper.width, PHYSICS.flipper.height, {
      chamfer: { radius: PHYSICS.flipper.height / 2 },
    });
    this.image.setBounce(0.25).setFriction(0.02).setDepth(3);
    this.image.setAngle(Phaser.Math.RadToDeg(this.config.restAngle));
    this.image.setData('kind', `flipper-${side}`);

    const body = this.image.body;
    if (!body) throw new Error(`Corps Matter absent pour le flipper ${side}`);

    scene.matter.add.worldConstraint(body as MatterJS.BodyType, 0, 0.95, {
      pointA: this.config.pivot,
      pointB: {
        x: side === 'left' ? -PHYSICS.flipper.width / 2 : PHYSICS.flipper.width / 2,
        y: 0,
      },
      damping: 0.12,
    });
  }

  public update(active: boolean): void {
    const target = active ? this.config.activeAngle : this.config.restAngle;
    const current = this.image.rotation;
    const delta = target - current;
    const speed = active ? PHYSICS.flipper.angularSpeed : PHYSICS.flipper.returnSpeed;

    if (Math.abs(delta) <= speed) {
      this.image.setRotation(target).setAngularVelocity(0);
      return;
    }

    this.image.setAngularVelocity(Math.sign(delta) * speed);

    const minAngle = Math.min(this.config.restAngle, this.config.activeAngle);
    const maxAngle = Math.max(this.config.restAngle, this.config.activeAngle);
    if (current < minAngle || current > maxAngle) {
      this.image.setRotation(Phaser.Math.Clamp(current, minAngle, maxAngle));
    }
  }
}
