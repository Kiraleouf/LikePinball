import { PHYSICS_3D } from '../config/physics3d';

interface Vector { readonly x: number; readonly y: number; readonly z: number }
/** Add radial momentum in the board plane, retaining tangential velocity and avoiding lift. */
export function bumperImpulse(position: Vector, center: Vector, velocity: Vector, boardNormal: Vector, mass: number, power: number = PHYSICS_3D.bumperKickSpeed): Vector {
  const dx = position.x - center.x; const dy = position.y - center.y; const dz = position.z - center.z;
  const normalDistance = dx * boardNormal.x + dy * boardNormal.y + dz * boardNormal.z;
  return directionalImpulse({ x: dx - normalDistance * boardNormal.x, y: dy - normalDistance * boardNormal.y, z: dz - normalDistance * boardNormal.z }, velocity, mass, power);
}

/** Add momentum along a surface normal without rotating existing tangential motion. */
export function directionalImpulse(direction: Vector, velocity: Vector, mass: number, power: number): Vector {
  let { x, y, z } = direction;
  const length = Math.hypot(x, y, z);
  if (length < 1e-6 || mass <= 0) return { x: 0, y: 0, z: 0 };
  x /= length; y /= length; z /= length;
  const radialSpeed = velocity.x * x + velocity.y * y + velocity.z * z;
  const speedSquared = velocity.x ** 2 + velocity.y ** 2 + velocity.z ** 2;
  // Solve |v + kick*n| <= maxSpeed, so capping the kick never rotates the existing motion.
  const headroom = -radialSpeed + Math.sqrt(Math.max(0, radialSpeed ** 2 + PHYSICS_3D.maxBallSpeed ** 2 - speedSquared));
  const impulse = mass * Math.max(0, Math.min(power, headroom));
  return { x: x * impulse, y: y * impulse, z: z * impulse };
}
