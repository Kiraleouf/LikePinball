export class ScoreState {
  public value = 0;

  public add(points: number): number {
    this.value += points;
    return this.value;
  }
}
