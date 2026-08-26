import { describe, expect, it } from 'vitest';
import { createRng, freeCells, shuffle, spawnFruit } from '../src/game/board';
import { occupies } from '../src/game/collision';
import type { Snake, Vec } from '../src/types';

function fillBoard(cols: number, rows: number, except: Vec[]): Snake {
  const segments: Vec[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      if (!except.some((cell) => cell.x === x && cell.y === y)) segments.push({ x, y });
    }
  }
  return { segments, direction: 'right', pending: [] };
}

describe('board', () => {
  it('lista todas as celulas livres', () => {
    const snake: Snake = {
      segments: [
        { x: 0, y: 0 },
        { x: 1, y: 0 },
      ],
      direction: 'right',
      pending: [],
    };
    expect(freeCells(snake, 3, 3).length).toBe(7);
  });

  it('a fruta nunca nasce em cima da cobra (tabuleiro quase cheio)', () => {
    const free: Vec[] = [
      { x: 3, y: 4 },
      { x: 7, y: 1 },
    ];
    const snake = fillBoard(10, 10, free);
    for (let seed = 0; seed < 200; seed += 1) {
      const fruit = spawnFruit(createRng(seed), snake, 10, 10);
      expect(fruit).not.toBeNull();
      expect(occupies(snake, fruit as Vec)).toBe(false);
      expect(free).toContainEqual(fruit);
    }
  });

  it('a fruta nunca nasce em cima da cobra (tabuleiro 20x20)', () => {
    const snake: Snake = {
      segments: [
        { x: 10, y: 10 },
        { x: 9, y: 10 },
        { x: 8, y: 10 },
      ],
      direction: 'right',
      pending: [],
    };
    const rng = createRng(1234);
    for (let i = 0; i < 500; i += 1) {
      const fruit = spawnFruit(rng, snake);
      expect(fruit).not.toBeNull();
      expect(occupies(snake, fruit as Vec)).toBe(false);
    }
  });

  it('retorna null quando o tabuleiro esta cheio', () => {
    expect(spawnFruit(createRng(1), fillBoard(4, 4, []), 4, 4)).toBeNull();
  });

  it('shuffle e determinista com o mesmo seed e nao muda o original', () => {
    const items = [1, 2, 3, 4, 5, 6, 7, 8];
    const a = shuffle(items, createRng(42));
    const b = shuffle(items, createRng(42));
    expect(a).toEqual(b);
    expect(items).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect([...a].sort((x, y) => x - y)).toEqual(items);
  });
});
