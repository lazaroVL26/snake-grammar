import { describe, expect, it } from 'vitest';
import { hitsSelf, hitsWall, occupies } from '../src/game/collision';
import { step } from '../src/game/snake';
import type { Snake } from '../src/types';

const COLS = 20;
const ROWS = 20;

describe('collision', () => {
  it('detecta colisao com cada uma das 4 paredes', () => {
    expect(hitsWall({ x: -1, y: 5 }, COLS, ROWS)).toBe(true);
    expect(hitsWall({ x: 5, y: -1 }, COLS, ROWS)).toBe(true);
    expect(hitsWall({ x: COLS, y: 5 }, COLS, ROWS)).toBe(true);
    expect(hitsWall({ x: 5, y: ROWS }, COLS, ROWS)).toBe(true);
  });

  it('nao acusa parede dentro do tabuleiro', () => {
    expect(hitsWall({ x: 0, y: 0 }, COLS, ROWS)).toBe(false);
    expect(hitsWall({ x: COLS - 1, y: ROWS - 1 }, COLS, ROWS)).toBe(false);
  });

  it('detecta autocolisao real', () => {
    // Cobra em U: ao virar para cima a cabeca entra em cima do proprio corpo.
    const snake: Snake = {
      segments: [
        { x: 5, y: 5 },
        { x: 4, y: 5 },
        { x: 4, y: 4 },
        { x: 5, y: 4 },
        { x: 6, y: 4 },
      ],
      direction: 'right',
      pending: ['up'],
    };
    const moved = step(snake);
    expect(moved.segments[0]).toEqual({ x: 5, y: 4 });
    expect(hitsSelf(moved)).toBe(true);
  });

  it('nao acusa colisao quando a cabeca ocupa a celula que a cauda liberou', () => {
    // Quadrado 2x2 fechado: a cabeca entra exatamente onde a cauda estava.
    const snake: Snake = {
      segments: [
        { x: 5, y: 5 },
        { x: 5, y: 4 },
        { x: 4, y: 4 },
        { x: 4, y: 5 },
      ],
      direction: 'down',
      pending: ['left'],
    };
    const moved = step(snake);
    expect(moved.segments[0]).toEqual({ x: 4, y: 5 });
    expect(hitsSelf(moved)).toBe(false);
  });

  it('occupies encontra qualquer segmento', () => {
    const snake: Snake = {
      segments: [
        { x: 1, y: 1 },
        { x: 0, y: 1 },
      ],
      direction: 'right',
      pending: [],
    };
    expect(occupies(snake, { x: 0, y: 1 })).toBe(true);
    expect(occupies(snake, { x: 2, y: 1 })).toBe(false);
  });
});
