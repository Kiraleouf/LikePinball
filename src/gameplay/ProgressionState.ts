export class ProgressionState {
  public portalUnlocked = false;

  public constructor(public readonly targetScore: number) {}

  public update(score: number): boolean {
    if (this.portalUnlocked || score < this.targetScore) return false;
    this.portalUnlocked = true;
    return true;
  }

  public ratio(score: number): number {
    return Math.min(1, Math.max(0, score / this.targetScore));
  }

  public canEnterPortal(colliderLabel: string): boolean {
    return this.portalUnlocked && colliderLabel === 'portal';
  }
}
