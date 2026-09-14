import { BACKGROUND_COLOR } from '../config/game';
import type { TableDefinition } from './types';

export const TABLE_ZERO: TableDefinition = {
  id: 0,
  name: 'Plateau 0',
  backgroundColor: BACKGROUND_COLOR,
  spawn: { x: 585, y: 940 },
  walls: [
    { x: 100, y: 540, width: 28, height: 920 },
    { x: 620, y: 540, width: 28, height: 920 },
    { x: 360, y: 72, width: 548, height: 28 },
    { x: 550, y: 670, width: 18, height: 690 },
    { x: 195, y: 980, width: 235, height: 28, angle: 0.18 },
    { x: 525, y: 980, width: 235, height: 28, angle: -0.18 },
  ],
  drain: { x: 360, y: 1060, width: 260, height: 40 },
  bumpers: [
    { id: 'left', x: 245, y: 390, radius: 42, score: 500, color: 0xff3bc8 },
    { id: 'right', x: 455, y: 390, radius: 42, score: 500, color: 0xff3bc8 },
    { id: 'center', x: 350, y: 550, radius: 38, score: 750, color: 0xffbd35 },
  ],
};
