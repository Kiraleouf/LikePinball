export class SectorUnlockState {
  private unlockedCount = 0;

  public constructor(private readonly thresholds: readonly number[]) {}

  public update(score: number): readonly number[] {
    const unlocked: number[] = [];
    while (this.unlockedCount < this.thresholds.length && score >= this.thresholds[this.unlockedCount]) {
      unlocked.push(this.unlockedCount);
      this.unlockedCount += 1;
    }
    return unlocked;
  }

  public get nextThreshold(): number | undefined {
    return this.thresholds[this.unlockedCount];
  }

  public get highestAccessibleSector(): number {
    return this.unlockedCount;
  }
}
