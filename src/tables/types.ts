export interface WorldDefinition {
  readonly backgroundColor: number;
  readonly spawn: Point;
  readonly drain: RectangleDefinition;
  readonly safetyPost: CircleDefinition;
  readonly sectors: SectorDefinition[];
}

export interface SectorDefinition {
  readonly id: number;
  readonly name: string;
  readonly offsetY: number;
  readonly walls: readonly WallDefinition[];
  readonly bumpers: readonly BumperDefinition[];
  readonly rails: readonly RailDefinition[];
  readonly obstacles: readonly WallDefinition[];
  readonly flippers: readonly FlipperDefinition[];
}

export interface BumperDefinition extends Point { readonly id: string; readonly radius: number; readonly score: number; readonly color: number }
export interface Point { readonly x: number; readonly y: number }
export interface CircleDefinition extends Point { readonly radius: number }
export interface RectangleDefinition extends Point { readonly width: number; readonly height: number }
export interface WallDefinition extends RectangleDefinition { readonly angle?: number }
export interface FlipperDefinition extends Point {
  readonly id: string;
  readonly side: 'left' | 'right';
  readonly restAngle: number;
  readonly activeAngle: number;
}
export interface RailDefinition { readonly id: string; readonly points: readonly Point[]; readonly thickness: number; readonly color: number }
