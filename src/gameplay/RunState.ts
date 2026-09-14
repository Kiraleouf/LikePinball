export type RunPhase = 'ready' | 'playing' | 'game-over';

export class RunState {
  public phase: RunPhase = 'ready';

  public constructor(public ballsRemaining: number) {}

  public launch(): boolean {
    if (this.phase !== 'ready' || this.ballsRemaining <= 0) return false;
    this.phase = 'playing';
    return true;
  }

  public loseBall(): void {
    if (this.phase !== 'playing') return;

    this.ballsRemaining = Math.max(0, this.ballsRemaining - 1);
    this.phase = this.ballsRemaining > 0 ? 'ready' : 'game-over';
  }
}
