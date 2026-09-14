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
  flipper: {
    width: 132,
    height: 24,
    angularSpeed: 0.34,
    returnSpeed: 0.24,
    left: {
      pivot: { x: 245, y: 925 },
      restAngle: 0.32,
      activeAngle: -0.5,
    },
    right: {
      pivot: { x: 475, y: 925 },
      restAngle: -0.32,
      activeAngle: 0.5,
    },
  },
  launcher: {
    velocity: { x: -2.6, y: -25 },
  },
} as const;
