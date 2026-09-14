export class ScoreState {
  public constructor(public value = 0) {}

  public add(points: number): number {
    this.value += points;
    return this.value;
  }
}
