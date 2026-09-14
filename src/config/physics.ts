export const PHYSICS = {
  gravity: 0.75,
  ball: {
    radius: 16,
    restitution: 0.72,
    friction: 0.002,
    frictionAir: 0.004,
    density: 0.002,
    maxSpeed: 28,
    initialVelocity: { x: 4, y: 0 },
  },
  wall: {
    restitution: 0.45,
    friction: 0.02,
  },
} as const;
