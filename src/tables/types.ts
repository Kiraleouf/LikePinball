export interface TableDefinition {
  readonly id: number;
  readonly name: string;
  readonly backgroundColor: number;
  readonly spawn: Point;
  readonly walls: readonly WallDefinition[];
  readonly drain: RectangleDefinition;
  readonly bumpers: readonly BumperDefinition[];
  readonly rails: readonly RailDefinition[];
}

export interface BumperDefinition extends Point {
  readonly id: string;
  readonly radius: number;
  readonly score: number;
  readonly color: number;
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

export interface RailDefinition {
  readonly id: string;
  readonly points: readonly Point[];
  readonly thickness: number;
  readonly color: number;
}
