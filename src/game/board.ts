import { CONFIG } from '../config';
import type { Rng, Snake, Vec } from '../types';
import { occupies } from './collision';

/** PRNG determinista (mulberry32) para testes e para o embaralhamento seedado. */
export function createRng(seed: number): Rng {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function freeCells(
  snake: Snake,
  cols: number = CONFIG.GRID_COLS,
  rows: number = CONFIG.GRID_ROWS,
): Vec[] {
  const cells: Vec[] = [];
  for (let y = 0; y < rows; y += 1) {
    for (let x = 0; x < cols; x += 1) {
      const cell = { x, y };
      if (!occupies(snake, cell)) cells.push(cell);
    }
  }
  return cells;
}

/** Sorteia uma celula livre. Retorna null quando o tabuleiro esta cheio. */
export function spawnFruit(
  rng: Rng,
  snake: Snake,
  cols: number = CONFIG.GRID_COLS,
  rows: number = CONFIG.GRID_ROWS,
): Vec | null {
  const cells = freeCells(snake, cols, rows);
  if (cells.length === 0) return null;
  const picked = cells[Math.floor(rng() * cells.length) % cells.length];
  return picked ?? null;
}

/** Fisher-Yates com PRNG injetavel. Nao altera o array recebido. */
export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const a = copy[i];
    const b = copy[j];
    if (a === undefined || b === undefined) continue;
    copy[i] = b;
    copy[j] = a;
  }
  return copy;
}
