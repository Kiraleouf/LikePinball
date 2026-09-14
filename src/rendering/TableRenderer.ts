import Phaser from 'phaser';
import { COLORS } from '../config/game';
import type { TableDefinition } from '../tables/types';

export class TableRenderer {
  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly table: TableDefinition,
  ) {}

  public draw(): void {
    this.scene.add
      .rectangle(360, 548, 568, 1000, COLORS.graphite)
      .setStrokeStyle(2, COLORS.mutedCyan);

    for (const wall of this.table.walls) {
      this.scene.add
        .rectangle(wall.x, wall.y, wall.width, wall.height, COLORS.graphite)
        .setStrokeStyle(3, COLORS.cyan, 0.85)
        .setRotation(wall.angle ?? 0);
    }

    this.scene.add
      .rectangle(
        this.table.drain.x,
        this.table.drain.y,
      this.table.drain.width,
      this.table.drain.height,
      )
      .setStrokeStyle(2, COLORS.cyan, 0.45);
  }

  public createBallTexture(): string {
    const key = 'ball';
    if (this.scene.textures.exists(key)) return key;

    const radius = 16;
    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(COLORS.cyan, 0.18);
    graphics.fillCircle(radius + 4, radius + 4, radius + 4);
    graphics.fillStyle(COLORS.white, 1);
    graphics.fillCircle(radius + 4, radius + 4, radius);
    graphics.fillStyle(COLORS.cyan, 1);
    graphics.fillCircle(radius, radius, 5);
    graphics.generateTexture(key, (radius + 4) * 2, (radius + 4) * 2);
    graphics.destroy();
    return key;
  }

  public createFlipperTexture(): string {
    const key = 'flipper';
    if (this.scene.textures.exists(key)) return key;

    const { width, height } = { width: 132, height: 24 };
    const graphics = this.scene.make.graphics({ x: 0, y: 0 }, false);
    graphics.fillStyle(COLORS.mutedCyan, 1);
    graphics.fillRoundedRect(2, 2, width - 4, height - 4, height / 2);
    graphics.lineStyle(3, COLORS.cyan, 1);
    graphics.strokeRoundedRect(2, 2, width - 4, height - 4, height / 2);
    graphics.generateTexture(key, width, height);
    graphics.destroy();
    return key;
  }
}
