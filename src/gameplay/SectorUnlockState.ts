export class SectorUnlockState {
  private unlockedCount = 0;

  public constructor(private readonly thresholdForSector: (sector: number) => number) {}

  public update(score: number): readonly number[] {
    const unlocked: number[] = [];
    while (score >= this.thresholdForSector(this.unlockedCount + 1)) {
      unlocked.push(this.unlockedCount);
      this.unlockedCount += 1;
    }
    return unlocked;
  }

  public get nextThreshold(): number {
    return this.thresholdForSector(this.unlockedCount + 1);
  }

  public get highestAccessibleSector(): number {
    return this.unlockedCount;
  }
}
