import { BACKGROUND_COLOR } from '../config/game';
import type { WorldDefinition } from './types';

export const WORLD: WorldDefinition = {
  backgroundColor: BACKGROUND_COLOR,
  spawn: { x: 585, y: 940 },
  drain: { x: 360, y: 1060, width: 260, height: 40 },
  safetyPost: { x: 360, y: 962, radius: 11 },
  sectors: [
    {
      id: 0, name: 'Secteur 0', offsetY: 0,
      walls: [
        { x: 100, y: 540, width: 28, height: 920 }, { x: 620, y: 540, width: 28, height: 920 },
        { x: 550, y: 670, width: 18, height: 690 },
        { x: 195, y: 980, width: 235, height: 28, angle: 0.18 }, { x: 525, y: 980, width: 235, height: 28, angle: -0.18 },
      ],
      bumpers: [
        { id: 's0-left', x: 245, y: 390, radius: 42, score: 2_500, color: 0xff3bc8 },
        { id: 's0-right', x: 455, y: 390, radius: 42, score: 2_500, color: 0xff3bc8 },
        { id: 's0-center', x: 350, y: 550, radius: 38, score: 2_500, color: 0xffbd35 },
      ],
      rails: [
        { id: 's0-upper-left', thickness: 12, color: 0x35e7ff, points: [{ x: 124, y: 330 }, { x: 135, y: 275 }, { x: 165, y: 225 }, { x: 215, y: 190 }] },
        { id: 's0-upper-right', thickness: 12, color: 0x35e7ff, points: [{ x: 515, y: 190 }, { x: 535, y: 225 }, { x: 545, y: 270 }] },
        { id: 's0-left-orbit', thickness: 11, color: 0x35e7ff, points: [{ x: 145, y: 505 }, { x: 155, y: 590 }, { x: 190, y: 675 }, { x: 235, y: 730 }] },
        { id: 's0-right-orbit', thickness: 11, color: 0x35e7ff, points: [{ x: 515, y: 505 }, { x: 505, y: 590 }, { x: 480, y: 675 }, { x: 445, y: 730 }] },
        { id: 's0-left-sling', thickness: 14, color: 0xff3bc8, points: [{ x: 155, y: 780 }, { x: 225, y: 850 }] },
        { id: 's0-right-sling', thickness: 14, color: 0xff3bc8, points: [{ x: 515, y: 780 }, { x: 455, y: 850 }] },
      ],
    },
    {
      id: 1, name: 'Secteur 1', offsetY: -1_000,
      walls: [
        { x: 100, y: 540, width: 28, height: 920 }, { x: 620, y: 540, width: 28, height: 920 },
      ],
      bumpers: [
        { id: 's1-left', x: 235, y: 465, radius: 40, score: 750, color: 0x35e7ff },
        { id: 's1-right', x: 465, y: 465, radius: 40, score: 750, color: 0x35e7ff },
      ],
      rails: [
        { id: 's1-chevron-left', thickness: 13, color: 0xffbd35, points: [{ x: 155, y: 265 }, { x: 260, y: 345 }, { x: 180, y: 650 }] },
        { id: 's1-chevron-right', thickness: 13, color: 0xffbd35, points: [{ x: 515, y: 265 }, { x: 410, y: 345 }, { x: 490, y: 650 }] },
      ],
    },
    {
      id: 2, name: 'Secteur 2', offsetY: -2_000,
      walls: [
        { x: 100, y: 540, width: 28, height: 920 }, { x: 620, y: 540, width: 28, height: 920 },
      ],
      bumpers: [
        { id: 's2-left', x: 210, y: 430, radius: 36, score: 1_500, color: 0xffbd35 },
        { id: 's2-right', x: 490, y: 570, radius: 36, score: 1_500, color: 0xffbd35 },
      ],
      rails: [
        { id: 's2-left', thickness: 12, color: 0xff3bc8, points: [{ x: 145, y: 260 }, { x: 240, y: 340 }] },
        { id: 's2-right', thickness: 12, color: 0xff3bc8, points: [{ x: 575, y: 690 }, { x: 470, y: 610 }] },
      ],
    },
    {
      id: 3, name: 'Secteur 3', offsetY: -3_000,
      walls: [
        { x: 100, y: 540, width: 28, height: 920 }, { x: 620, y: 540, width: 28, height: 920 },
        { x: 360, y: 72, width: 548, height: 28 },
      ],
      bumpers: [
        { id: 's3-center', x: 360, y: 470, radius: 48, score: 2_500, color: 0x35e7ff },
      ],
      rails: [
        { id: 's3-crown', thickness: 13, color: 0x35e7ff, points: [{ x: 180, y: 620 }, { x: 360, y: 540 }, { x: 540, y: 620 }] },
      ],
    },
  ],
};

export const worldY = (localY: number, offsetY: number): number => localY + offsetY;
