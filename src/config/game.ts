export const GAME_WIDTH = 720;
export const GAME_HEIGHT = 1080;
export const BACKGROUND_COLOR = 0x020508;

export const COLORS = {
  cyan: 0x35e7ff,
  graphite: 0x101820,
  mutedCyan: 0x123a44,
  white: 0xe8fbff,
} as const;

export const STARTING_BALLS = 3;
const INITIAL_SECTOR_UNLOCK_SCORES = [10_000, 50_000, 100_000] as const;

export function sectorUnlockScore(targetSector: number): number {
  return INITIAL_SECTOR_UNLOCK_SCORES[targetSector - 1]
    ?? 100_000 + (targetSector - 3) * 75_000;
}

export const CAMERA = {
  sectorHeight: 1_000,
  seamY: 80,
  engagement: 160,
  transitionMs: 280,
} as const;
