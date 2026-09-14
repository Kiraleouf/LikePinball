export class MotionGuard {
  private stillForMs = 0;

  public update(speed: number, deltaMs: number, threshold: number, delayMs: number): boolean {
    if (speed >= threshold) {
      this.stillForMs = 0;
      return false;
    }

    this.stillForMs += deltaMs;
    if (this.stillForMs < delayMs) return false;
    this.stillForMs = 0;
    return true;
  }
}
