/** Three/Rapier tuning, in world units and seconds. */
export const PHYSICS_3D = {
  tilt: 0.18,
  gravity: 30,
  timestep: 1 / 120,
  maxFrameTime: 0.1,
  maxBallSpeed: 34,
  linearDamping: 0.025,
  ballRestitution: 0.72,
  ballFriction: 0.08,
  flipperAngularSpeed: 16,
  flipperReturnSpeed: 10,
  launchMinSpeed: 18,
  launchExtraSpeed: 16,
} as const;

/** Template angles are in screen coordinates, opposite to Three's Y rotation. */
export const flipperYaw = (angle: number): number => -angle;
export function approachAngle(current: number, target: number, speed: number, delta: number): number {
  return current + Math.sign(target - current) * Math.min(Math.abs(target - current), speed * delta);
}
