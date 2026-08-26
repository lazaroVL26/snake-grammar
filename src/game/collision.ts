import type { Snake, Vec } from '../types';
import { head, sameCell } from './snake';

export function hitsWall(position: Vec, cols: number, rows: number): boolean {
  return position.x < 0 || position.y < 0 || position.x >= cols || position.y >= rows;
}

/**
 * Autocolisao: compara a cabeca com o corpo ja depois do passo. Como a cauda
 * sai do array no mesmo passo, entrar na celula recem-liberada nao colide.
 */
export function hitsSelf(snake: Snake): boolean {
  const h = head(snake);
  return snake.segments.slice(1).some((segment) => sameCell(segment, h));
}

export function occupies(snake: Snake, position: Vec): boolean {
  return snake.segments.some((segment) => sameCell(segment, position));
}
