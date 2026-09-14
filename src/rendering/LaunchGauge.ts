import Phaser from 'phaser';

export class LaunchGauge {
  private readonly fill: Phaser.GameObjects.Rectangle;
  private readonly percent: Phaser.GameObjects.Text;

  public constructor(scene: Phaser.Scene) {
    const x = 676;
    const bottom = 700;
    const height = 330;
    scene.add.rectangle(x, bottom - height / 2, 22, height, 0x071016, 0.9)
      .setStrokeStyle(2, 0x35e7ff, 0.45).setDepth(4);
    scene.add.rectangle(x, bottom - height * 0.165, 14, height * 0.33, 0x28ef8b, 0.3).setDepth(4);
    scene.add.rectangle(x, bottom - height * 0.5, 14, height * 0.34, 0xffbd35, 0.3).setDepth(4);
    scene.add.rectangle(x, bottom - height * 0.835, 14, height * 0.33, 0xff4d67, 0.3).setDepth(4);
    this.fill = scene.add.rectangle(x, bottom, 8, height, 0xe8fbff, 0.9)
      .setOrigin(0.5, 1).setScale(1, 0).setDepth(5);
    this.percent = scene.add.text(x, bottom + 18, '0%', {
      color: '#79aebb', fontFamily: 'monospace', fontSize: '12px', fontStyle: 'bold',
    }).setOrigin(0.5, 0).setDepth(5);
    scene.add.text(x, bottom - height - 20, '100', {
      color: '#ff4d67', fontFamily: 'monospace', fontSize: '10px',
    }).setOrigin(0.5).setDepth(5);
  }

  public update(value: number): void {
    this.fill.setScale(1, value);
    this.fill.setFillStyle(value < 0.34 ? 0x28ef8b : value < 0.67 ? 0xffbd35 : 0xff4d67, 0.95);
    this.percent.setText(`${Math.round(value * 100)}%`);
  }
}
