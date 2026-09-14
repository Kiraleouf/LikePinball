export interface TableDefinition {
  readonly id: number;
  readonly name: string;
  readonly backgroundColor: number;
  readonly spawn: Point;
  readonly walls: readonly WallDefinition[];
  readonly drain: RectangleDefinition;
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

export interface RectangleDefinition extends Point {
  readonly width: number;
  readonly height: number;
}

export interface WallDefinition extends RectangleDefinition {
  readonly angle?: number;
}
