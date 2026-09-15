export const PHYSICS = {
  gravity: 0.76,
  ball: {
    radius: 16,
    restitution: 0.7,
    friction: 0.002,
    frictionAir: 0.0045,
    density: 0.003,
    maxSpeed: 28,
  },
  wall: {
    restitution: 0.45,
    friction: 0.02,
  },
  safetyPost: {
    restitution: 0.72,
    friction: 0.015,
  },
  flipper: {
    width: 108,
    height: 24,
    angularSpeed: 0.3,
    returnSpeed: 0.2,
    kickVelocityY: -26,
    kickVelocityX: 6.5,
    tapHoldMs: 180,
    left: {
      pivot: { x: 220, y: 925 },
      restAngle: 0.3,
      activeAngle: -0.56,
    },
    right: {
      pivot: { x: 500, y: 925 },
      restAngle: -0.3,
      activeAngle: 0.56,
    },
  },
  launcher: {
    minVelocityY: -10,
    maxVelocityY: -32,
    chargeCycleMs: 1_400,
    retryZoneY: 910,
    exitHeight: 300,
    exitVelocityX: -9,
    gate: {
      x: 585,
      y: 300,
      width: 86,
      height: 10,
      angle: -0.36,
      closeWhenBallXBelow: 520,
    },
  },
  bumper: {
    restitution: 1.15,
    kickSpeed: 20,
  },
  antiStall: {
    speedThreshold: 0.45,
    delayMs: 1_800,
    nudgeVelocity: { x: 1.2, y: -5.5 },
    maxY: 880,
  },
} as const;
