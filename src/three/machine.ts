/** Structural machine geometry in board coordinates, shared by game and Sector Lab. */
export const LAUNCHER = {
  x: 6.8, spawnZ: 8, plungerZ: 9.05,
  gateX: 5.75, gateZ: -8.5, gateLength: 3,
  wallTop: -7, retryZ: 8.5,
} as const;
export interface MachineBox { name: string; x: number; z: number; y: number; width: number; depth: number; height: number; yaw: number }
export function launcherStructure(): MachineBox[] {
  const boxes: MachineBox[] = [
    { name: 'plateau-launcher', x: 6.8, z: 0, y: -0.25, width: 2.2, depth: 20, height: 0.5, yaw: 0 },
    { name: 'launcher-outer', x: 7.85, z: 1.5, y: 0.5, width: 0.3, depth: 17, height: 1.5, yaw: 0 },
    { name: 'launcher-bottom', x: 6.8, z: 9.8, y: 0.5, width: 2.2, depth: 0.3, height: 1.5, yaw: 0 },
  ];
  // A continuous rounded outer guide bends the upward shot into the playfield.
  const centerX = 5.3; const centerZ = -7; const radius = 2.55;
  for (let i = 0; i < 16; i++) {
    const a = i / 16 * Math.PI / 2; const b = (i + 1) / 16 * Math.PI / 2;
    const ax = centerX + radius * Math.cos(a); const az = centerZ - radius * Math.sin(a);
    const bx = centerX + radius * Math.cos(b); const bz = centerZ - radius * Math.sin(b);
    boxes.push({ name: 'launcher-curve', x: (ax + bx) / 2, z: (az + bz) / 2, y: 0.5, width: Math.hypot(bx - ax, bz - az) + 0.04, depth: 0.3, height: 1.5, yaw: -Math.atan2(bz - az, bx - ax) });
  }
  return boxes;
}
export function rightBoundary(sector: number): { z: number; length: number } {
  return sector === 0 ? { z: 1.5, length: 17 } : { z: -sector * 20, length: 20 };
}
export function hasExitedLauncher(x: number, z: number, ballRadius = 0.42): boolean { return x < LAUNCHER.gateX - 0.15 - ballRadius - 0.13 && z < LAUNCHER.wallTop; }
