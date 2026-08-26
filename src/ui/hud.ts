import type { GameState } from '../types';
import { el } from './dom';

interface Cell {
  root: HTMLElement;
  value: HTMLElement;
}

function cell(label: string): Cell {
  const value = el('strong', { class: 'hud__value', text: '0' });
  const root = el('div', { class: 'hud__cell' }, [
    el('span', { class: 'hud__label', text: label }),
    value,
  ]);
  return { root, value };
}

/** HUD e texto real no DOM (nunca desenho no canvas) para leitores de tela. */
export class Hud {
  private readonly score = cell('Pontos');
  private readonly length = cell('Comprimento');
  private readonly answers = cell('Acertos / erros');
  private readonly best = cell('Recorde');

  constructor(private readonly root: HTMLElement) {
    root.setAttribute('role', 'status');
    root.setAttribute('aria-live', 'polite');
    root.append(this.score.root, this.length.root, this.answers.root, this.best.root);
  }

  update(state: GameState, bestScore: number): void {
    this.score.value.textContent = String(state.stats.score);
    this.length.value.textContent = String(state.snake.segments.length);
    this.answers.value.textContent = `${state.stats.correctCount} / ${state.stats.wrongCount}`;
    this.best.value.textContent = String(Math.max(bestScore, state.stats.score));
    this.root.dataset.streak = String(state.stats.streak);
  }
}
