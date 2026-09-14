export class LaunchChargeState {
  public value = 0;
  public active = false;
  private direction: 1 | -1 = 1;

  public constructor(private readonly halfCycleMs: number) {}

  public start(): void {
    this.value = 0;
    this.direction = 1;
    this.active = true;
  }

  public update(deltaMs: number): void {
    if (!this.active) return;
    let next = this.value + this.direction * deltaMs / this.halfCycleMs;
    while (next > 1 || next < 0) {
      if (next > 1) {
        next = 2 - next;
        this.direction = -1;
      } else {
        next = -next;
        this.direction = 1;
      }
    }
    this.value = next;
  }

  public release(): number | undefined {
    if (!this.active) return undefined;
    this.active = false;
    return this.value;
  }

  public reset(): void {
    this.value = 0;
    this.direction = 1;
    this.active = false;
  }
}
