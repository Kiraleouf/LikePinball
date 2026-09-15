export class CameraSectorState {
  public currentSector = 0;

  public constructor(
    private readonly sectorCount: number,
    private readonly sectorHeight: number,
    private readonly seamY: number,
    private readonly engagement: number,
  ) {}

  public update(ballY: number): number | undefined {
    const upperBoundary = this.seamY - this.currentSector * this.sectorHeight;
    if (this.currentSector < this.sectorCount - 1 && ballY < upperBoundary - this.engagement) {
      this.currentSector += 1;
      return this.currentSector;
    }
    if (this.currentSector > 0) {
      const lowerBoundary = this.seamY - (this.currentSector - 1) * this.sectorHeight;
      if (ballY > lowerBoundary + this.engagement) {
        this.currentSector -= 1;
        return this.currentSector;
      }
    }
    return undefined;
  }
}
