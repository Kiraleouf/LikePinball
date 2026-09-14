import Phaser from 'phaser';
import { TABLE_ZERO } from '../tables/table0';

export class GameScene extends Phaser.Scene {
  public constructor() {
    super('game');
  }

  public create(): void {
    this.cameras.main.setBackgroundColor(TABLE_ZERO.backgroundColor);
  }
}
