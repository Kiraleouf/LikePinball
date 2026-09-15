import type { VisualParams } from '../three/components/presets';
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
  readonly posts?: readonly PostDefinition[];
  readonly slingshots?: readonly SlingshotDefinition[];
  readonly tubes?: readonly TubeDefinition[];
}

export interface BumperDefinition extends Point { readonly id: string; readonly radius: number; readonly score: number; readonly color: number }
export interface Point { readonly x: number; readonly y: number }
/** X/Y are template pixels, Z is height above the board in world units. */
export interface TubePoint extends Point { readonly z: number }
export interface TubeDefinition { readonly type: 'tube'; readonly id: string; readonly points: readonly TubePoint[]; readonly entry: 0; readonly exit: number; readonly params: VisualParams }
export interface CircleDefinition extends Point { readonly radius: number }
export interface PostDefinition extends CircleDefinition { readonly id: string }
export interface SlingshotDefinition extends Point { readonly id: string; readonly angle: number }
export interface RectangleDefinition extends Point { readonly width: number; readonly height: number }
export interface WallDefinition extends RectangleDefinition { readonly angle?: number }
export interface FlipperDefinition extends Point {
  readonly id: string;
  readonly side: 'left' | 'right';
  readonly restAngle: number;
  readonly activeAngle: number;
}
export interface RailDefinition { readonly id: string; readonly points: readonly Point[]; readonly thickness: number; readonly color: number }
