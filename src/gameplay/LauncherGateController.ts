import Phaser from 'phaser';
import { COLORS } from '../config/game';
import { PHYSICS } from '../config/physics';

export class LauncherGateController {
  private readonly body: MatterJS.BodyType;
  private closed = false;

  public constructor(scene: Phaser.Scene) {
    const gate = PHYSICS.launcher.gate;
    scene.add.rectangle(gate.x, gate.y, gate.width, gate.height, 0x14212a)
      .setRotation(gate.angle)
      .setStrokeStyle(2, COLORS.cyan, 0.9)
      .setDepth(3);
    scene.add.circle(gate.x + gate.width / 2 - 5, gate.y - 14, 6, COLORS.cyan, 0.85).setDepth(3);

    this.body = scene.matter.add.rectangle(gate.x, gate.y, gate.width, gate.height, {
      isStatic: true,
      angle: gate.angle,
      restitution: 0.35,
      label: 'launcher-gate',
      chamfer: { radius: gate.height / 2 },
    });
    this.openForLaunch();
  }

  public openForLaunch(): void {
    this.closed = false;
    this.body.collisionFilter.mask = 0;
  }

  public closeAfterExit(ballX: number): void {
    if (this.closed || ballX >= PHYSICS.launcher.gate.closeWhenBallXBelow) return;
    this.closed = true;
    this.body.collisionFilter.mask = 0xffff_ffff;
  }
}
