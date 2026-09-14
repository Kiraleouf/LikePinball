import Phaser from 'phaser';
import { COLORS } from '../config/game';
import type { CircleDefinition } from '../tables/types';

export class PortalController {
  private readonly ring: Phaser.GameObjects.Arc;
  private active = false;

  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly definition: CircleDefinition,
  ) {
    this.ring = scene.add.circle(definition.x, definition.y, definition.radius, 0x020508, 0.9)
      .setStrokeStyle(3, COLORS.mutedCyan, 0.65).setDepth(2);
    scene.add.circle(definition.x, definition.y, definition.radius - 13, 0x020508, 1)
      .setStrokeStyle(1, COLORS.mutedCyan, 0.35).setDepth(2);
  }

  public activate(): void {
    if (this.active) return;
    this.active = true;
    this.scene.matter.add.circle(this.definition.x, this.definition.y, this.definition.radius - 8, {
      isStatic: true, isSensor: true, label: 'portal',
    });
    this.ring.setStrokeStyle(5, COLORS.cyan, 1);
    this.scene.tweens.add({
      targets: this.ring, alpha: { from: 0.45, to: 1 }, scale: { from: 0.94, to: 1.08 },
      duration: 650, yoyo: true, repeat: -1, ease: 'Sine.inOut',
    });
  }
}
