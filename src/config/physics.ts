export const PHYSICS = {
  gravity: 0.62,
  ball: {
    radius: 16,
    restitution: 0.62,
    friction: 0.002,
    frictionAir: 0.006,
    density: 0.003,
    maxSpeed: 22,
  },
  wall: {
    restitution: 0.45,
    friction: 0.02,
  },
  flipper: {
    width: 132,
    height: 24,
    angularSpeed: 0.22,
    returnSpeed: 0.16,
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
    velocity: { x: 0, y: -25 },
    exitHeight: 300,
    exitVelocityX: -8,
  },
  bumper: {
    restitution: 1.15,
    kickSpeed: 16,
  },
  antiStall: {
    speedThreshold: 0.45,
    delayMs: 3_000,
    nudgeVelocity: { x: 1.2, y: -5.5 },
    maxY: 880,
  },
} as const;
