import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import {
  createSnake,
  grow,
  head,
  length,
  queueDirection,
  shrink,
  step,
} from '../src/game/snake';
import type { Direction } from '../src/types';

function snakeAt(x: number, y: number, direction: Direction = 'right') {
  return { segments: [{ x, y }], direction, pending: [] };
}

describe('snake', () => {
  it('anda um passo em cada direcao', () => {
    const cases: Array<[Direction, { x: number; y: number }]> = [
      ['up', { x: 5, y: 4 }],
      ['down', { x: 5, y: 6 }],
      ['left', { x: 4, y: 5 }],
      ['right', { x: 6, y: 5 }],
    ];
    for (const [direction, expected] of cases) {
      expect(head(step(snakeAt(5, 5, direction)))).toEqual(expected);
    }
  });

  it('cresce adicionando segmento sem perder a cauda no mesmo tick', () => {
    const snake = createSnake(20, 20, 3, 'right');
    const tail = snake.segments[2];
    const next = step(snake, { grow: true });
    expect(length(next)).toBe(4);
    expect(next.segments[3]).toEqual(tail);
  });

  it('encolhe removendo exatamente 1 segmento', () => {
    const snake = createSnake(20, 20, 4, 'right');
    const smaller = shrink(snake);
    expect(length(smaller)).toBe(3);
    expect(smaller.segments).toEqual(snake.segments.slice(0, 3));
  });

  it('nunca encolhe abaixo de 1 segmento', () => {
    expect(length(shrink(snakeAt(1, 1)))).toBe(1);
  });

  it('grow duplica a cauda sem mover a cabeca', () => {
    const snake = createSnake(20, 20, 3, 'right');
    const bigger = grow(snake);
    expect(length(bigger)).toBe(4);
    expect(head(bigger)).toEqual(head(snake));
  });

  it('ignora inversao de 180 graus', () => {
    const snake = createSnake(20, 20, 3, 'right');
    const queued = queueDirection(snake, 'left');
    expect(queued.pending).toEqual([]);
    expect(step(queued).direction).toBe('right');
  });

  it('ignora inversao de 180 graus contra a ultima virada enfileirada', () => {
    const snake = queueDirection(createSnake(20, 20, 3, 'right'), 'up');
    expect(queueDirection(snake, 'down').pending).toEqual(['up']);
  });

  it('aplica no maximo 1 virada por tick', () => {
    let snake = createSnake(20, 20, 3, 'right');
    snake = queueDirection(snake, 'up');
    snake = queueDirection(snake, 'left');
    expect(snake.pending).toEqual(['up', 'left']);

    const afterFirst = step(snake);
    expect(afterFirst.direction).toBe('up');
    expect(afterFirst.pending).toEqual(['left']);

    const afterSecond = step(afterFirst);
    expect(afterSecond.direction).toBe('left');
    expect(afterSecond.pending).toEqual([]);
  });

  it('nao enfileira alem do tamanho do buffer', () => {
    let snake = createSnake(20, 20, 3, 'right');
    snake = queueDirection(snake, 'up');
    snake = queueDirection(snake, 'left');
    snake = queueDirection(snake, 'down');
    expect(snake.pending.length).toBe(CONFIG.DIRECTION_BUFFER);
  });

  it('nasce com o corpo atras da cabeca', () => {
    const snake = createSnake(20, 20, 3, 'right');
    expect(snake.segments).toEqual([
      { x: 10, y: 10 },
      { x: 9, y: 10 },
      { x: 8, y: 10 },
    ]);
  });
});
