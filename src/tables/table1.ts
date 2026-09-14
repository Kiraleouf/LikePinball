import { BACKGROUND_COLOR } from '../config/game';
import type { TableDefinition } from './types';

export const TABLE_ONE: TableDefinition = {
  id: 1,
  name: 'Plateau 1',
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
    { id: 'one-left', x: 235, y: 465, radius: 40, score: 750, color: 0x35e7ff },
    { id: 'one-right', x: 465, y: 465, radius: 40, score: 750, color: 0x35e7ff },
  ],
  rails: [
    { id: 'one-chevron-left', thickness: 13, color: 0xffbd35, points: [
      { x: 155, y: 265 }, { x: 260, y: 345 }, { x: 180, y: 650 },], },
    { id: 'one-chevron-right', thickness: 13, color: 0xffbd35, points: [
      { x: 515, y: 265 }, { x: 410, y: 345 }, { x: 490, y: 650 },], },
  ],
  targetScore: 10_000,
  portal: { x: 360, y: 175, radius: 48 },
};
