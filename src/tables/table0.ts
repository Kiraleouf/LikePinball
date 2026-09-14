import { BACKGROUND_COLOR } from '../config/game';
import type { TableDefinition } from './types';

export const TABLE_ZERO: TableDefinition = {
  id: 0,
  name: 'Plateau 0',
  backgroundColor: BACKGROUND_COLOR,
  spawn: { x: 360, y: 180 },
  walls: [
    { x: 100, y: 540, width: 28, height: 920 },
    { x: 620, y: 540, width: 28, height: 920 },
    { x: 360, y: 72, width: 548, height: 28 },
    { x: 195, y: 980, width: 235, height: 28, angle: 0.18 },
    { x: 525, y: 980, width: 235, height: 28, angle: -0.18 },
  ],
  drain: { x: 360, y: 1060, width: 260, height: 40 },
};
