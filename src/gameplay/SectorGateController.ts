import Phaser from 'phaser';
import { COLORS, sectorUnlockScore } from '../config/game';
import type { SectorDefinition } from '../tables/types';
import { worldY } from '../tables';

interface Gate {
  readonly body: MatterJS.BodyType;
  readonly display: Phaser.GameObjects.Rectangle;
  readonly label: Phaser.GameObjects.Text;
  open: boolean;
}

export class SectorGateController {
  private readonly gates: Gate[] = [];

  public constructor(scene: Phaser.Scene, sectors: readonly SectorDefinition[]) {
    sectors.forEach((sector) => this.addGate(scene, sector));
  }

  public addGate(scene: Phaser.Scene, sector: SectorDefinition): void {
      const threshold = sectorUnlockScore(sector.id + 1);
      const y = worldY(80, sector.offsetY);
      const display = scene.add.rectangle(360, y, 492, 18, 0x101820)
        .setStrokeStyle(3, COLORS.cyan, 0.9).setDepth(3);
      const label = scene.add.text(360, y, `${threshold / 1_000}K`, {
        color: '#ffbd35', fontFamily: 'monospace', fontSize: '10px', fontStyle: 'bold', letterSpacing: 1,
      }).setOrigin(0.5).setDepth(3);
      const body = scene.matter.add.rectangle(360, y, 492, 18, {
        isStatic: true, restitution: 0.45, friction: 0.02, label: `sector-gate:${sector.id}`,
      });
      this.gates[sector.id] = { body, display, label, open: false };
  }

  public open(index: number, scene: Phaser.Scene): void {
    const gate = this.gates[index];
    if (!gate || gate.open) return;
    gate.open = true;
    scene.matter.world.remove(gate.body);
    gate.label.setText('SECTEUR OUVERT').setColor('#35e7ff');
    scene.tweens.add({ targets: [gate.display, gate.label], alpha: 0, duration: 450 });
  }
}
