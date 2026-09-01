import type { GameState } from '../types';
import { el } from './dom';

interface Cell {
  root: HTMLElement;
  value: HTMLElement;
}

function cell(label: string): Cell {
  const value = el('strong', { class: 'hud__value d-block', text: '0' });
  const root = el('div', { class: 'hud__cell' }, [
    el('div', { class: 'card h-100 px-3 py-2' }, [
      el('span', { class: 'hud__label d-block', text: label }),
      value,
    ]),
  ]);
  return { root, value };
}

/** Escreve o valor e pulsa quando ele muda: o "ganhei ponto" do fliperama. */
function write(cell: Cell, value: string): void {
  if (cell.value.textContent === value) return;
  cell.value.textContent = value;
  cell.value.classList.remove('hud__value--bump');
  // Leitura de layout forca o reinicio da animacao quando ela ja estava rodando.
  void cell.value.offsetWidth;
  cell.value.classList.add('hud__value--bump');
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
    write(this.score, String(state.stats.score));
    write(this.length, String(state.snake.segments.length));
    write(this.answers, `${state.stats.correctCount} / ${state.stats.wrongCount}`);
    write(this.best, String(Math.max(bestScore, state.stats.score)));
    this.root.dataset.streak = String(state.stats.streak);
  }
}
