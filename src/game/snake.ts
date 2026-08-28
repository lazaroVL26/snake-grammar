import { CONFIG } from '../config';
import type { Direction, Snake, Vec } from '../types';

const DELTA: Record<Direction, Vec> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
};

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

export function delta(direction: Direction): Vec {
  return DELTA[direction];
}

export function isOpposite(a: Direction, b: Direction): boolean {
  return OPPOSITE[a] === b;
}

export function sameCell(a: Vec, b: Vec): boolean {
  return a.x === b.x && a.y === b.y;
}

/** Cobra inicial: cabeca no centro, corpo esticado para tras da direcao inicial. */
export function createSnake(
  cols: number,
  rows: number,
  length: number = CONFIG.INITIAL_LENGTH,
  direction: Direction = 'right',
): Snake {
  const headX = Math.floor(cols / 2);
  const headY = Math.floor(rows / 2);
  const back = DELTA[OPPOSITE[direction]];
  const segments: Vec[] = [];
  for (let i = 0; i < length; i += 1) {
    segments.push({ x: headX + back.x * i, y: headY + back.y * i });
  }
  return { segments, direction, pending: [] };
}

export function head(snake: Snake): Vec {
  const first = snake.segments[0];
  if (!first) throw new Error('Cobra sem segmentos');
  return first;
}

/** Direcao que vale para validar a proxima virada: a ultima ja enfileirada. */
function referenceDirection(snake: Snake): Direction {
  return snake.pending[snake.pending.length - 1] ?? snake.direction;
}

/**
 * Enfileira uma virada. Ignora repeticao, inversao de 180 graus e enfileiramento
 * alem do limite do buffer — assim duas teclas no mesmo tick nunca viram a cobra
 * para dentro do proprio corpo.
 */
export function queueDirection(snake: Snake, direction: Direction): Snake {
  if (snake.pending.length >= CONFIG.DIRECTION_BUFFER) return snake;
  const reference = referenceDirection(snake);
  if (direction === reference || isOpposite(reference, direction)) return snake;
  return { ...snake, pending: [...snake.pending, direction] };
}

export function clearQueue(snake: Snake): Snake {
  return snake.pending.length === 0 ? snake : { ...snake, pending: [] };
}

/** Aplica no maximo uma virada enfileirada e anda um passo. */
export function step(snake: Snake, options: { grow?: boolean } = {}): Snake {
  const [next, ...rest] = snake.pending;
  const direction =
    next !== undefined && !isOpposite(snake.direction, next) ? next : snake.direction;

  const move = DELTA[direction];
  const current = head(snake);
  const nextHead: Vec = { x: current.x + move.x, y: current.y + move.y };

  const segments = [nextHead, ...snake.segments];
  if (!options.grow) segments.pop();

  return { segments, direction, pending: rest };
}

/** Cresce 1 segmento duplicando a cauda: o proximo passo o desdobra naturalmente. */
export function grow(snake: Snake): Snake {
  const tail = snake.segments[snake.segments.length - 1];
  if (!tail) return snake;
  return { ...snake, segments: [...snake.segments, { x: tail.x, y: tail.y }] };
}

/** Encolhe exatamente 1 segmento, nunca abaixo de 1. */
export function shrink(snake: Snake): Snake {
  if (snake.segments.length <= 1) return snake;
  return { ...snake, segments: snake.segments.slice(0, -1) };
}

/** Encolhe varios segmentos de uma vez, nunca abaixo de 1. */
export function shrinkBy(snake: Snake, amount: number): Snake {
  const keep = Math.max(1, snake.segments.length - Math.max(0, amount));
  if (keep === snake.segments.length) return snake;
  return { ...snake, segments: snake.segments.slice(0, keep) };
}

export function length(snake: Snake): number {
  return snake.segments.length;
}
