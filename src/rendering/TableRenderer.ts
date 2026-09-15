import Phaser from 'phaser';
import { COLORS } from '../config/game';
import { PHYSICS } from '../config/physics';
import type { TableDefinition } from '../tables/types';

export class TableRenderer {
  public constructor(
    private readonly scene: Phaser.Scene,
    private readonly table: TableDefinition,
  ) {}

  public draw(): void {
    const backdrop = this.scene.add.graphics().setDepth(1);
    backdrop.lineStyle(1, COLORS.mutedCyan, 0.16);
    for (let y = 220; y < 960; y += 110) backdrop.lineBetween(115, y, 605, y);
    backdrop.lineStyle(1, COLORS.cyan, 0.08);
    backdrop.lineBetween(360, 190, 360, 955);

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

    this.scene.add.text(this.table.drain.x, 1038, 'DRAIN', {
      color: '#406a74', fontFamily: 'monospace', fontSize: '11px', letterSpacing: 3,
    }).setOrigin(0.5).setDepth(2);
    const post = this.table.safetyPost;
    this.scene.add.circle(post.x, post.y, post.radius + 7, COLORS.cyan, 0.1).setDepth(2);
    this.scene.add.circle(post.x, post.y, post.radius, COLORS.graphite)
      .setStrokeStyle(3, COLORS.cyan, 0.95).setDepth(3);
    this.scene.add.circle(post.x, post.y, 3, COLORS.white, 0.9).setDepth(3);
    this.scene.add.text(585, 740, 'L A N C E U R', {
      color: '#406a74', fontFamily: 'monospace', fontSize: '10px', letterSpacing: 2,
    }).setOrigin(0.5).setAngle(-90).setDepth(2);

    this.drawRails();
  }

  private drawRails(): void {
    for (const rail of this.table.rails) {
      if (rail.points.length < 2) continue;
      const graphics = this.scene.add.graphics().setDepth(1);
      graphics.lineStyle(rail.thickness + 6, rail.color, 0.12);
      graphics.beginPath();
      graphics.moveTo(rail.points[0].x, rail.points[0].y);
      rail.points.slice(1).forEach((point) => graphics.lineTo(point.x, point.y));
      graphics.strokePath();
      graphics.lineStyle(rail.thickness, 0x152832, 1);
      graphics.strokePath();
      graphics.lineStyle(2, rail.color, 0.95);
      graphics.strokePath();
    }
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

    const { width, height } = PHYSICS.flipper;
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
