import { LEVEL_THRESHOLDS, REQUEUE_WINDOW } from '../config';
import { shuffle } from '../game/board';
import type { Question, Rng } from '../types';

interface Entry {
  question: Question;
  /** Repescada: volta a ser servida assim que chega na frente, ignorando o nivel. */
  forced: boolean;
}

/** Nivel alvo pela ordem da fruta (1-based). */
export function levelForFruit(fruitNumber: number): 1 | 2 | 3 {
  if (fruitNumber <= LEVEL_THRESHOLDS.LEVEL_1_UNTIL) return 1;
  if (fruitNumber <= LEVEL_THRESHOLDS.LEVEL_2_UNTIL) return 2;
  return 3;
}

/** Questao pronta para exibir: alternativas ja embaralhadas. */
export interface PresentedQuestion {
  question: Question;
  options: string[];
  answerIndex: number;
}

export function presentQuestion(question: Question, rng: Rng): PresentedQuestion {
  const correct = question.options[question.answerIndex];
  const options = shuffle(question.options, rng);
  const answerIndex = correct === undefined ? 0 : options.indexOf(correct);
  return { question, options, answerIndex: answerIndex < 0 ? 0 : answerIndex };
}

export class QuestionSelector {
  private queue: Entry[] = [];
  private served = 0;

  constructor(
    private readonly bank: readonly Question[],
    private readonly rng: Rng,
  ) {
    if (bank.length === 0) throw new Error('Banco de questoes vazio.');
    this.refill();
  }

  /** Quantas questoes ja foram servidas nesta partida. */
  get servedCount(): number {
    return this.served;
  }

  private refill(): void {
    const fresh = shuffle(this.bank, this.rng).map((question) => ({
      question,
      forced: false,
    }));
    this.queue = [...this.queue, ...fresh];
  }

  /** Proxima questao, respeitando repescagem e progressao de nivel. */
  next(): Question {
    if (this.queue.length === 0) this.refill();
    this.served += 1;

    const first = this.queue[0];
    if (first?.forced) {
      this.queue.shift();
      return first.question;
    }

    const target = levelForFruit(this.served);
    const index = this.findByLevel(target);
    const entry = this.queue[index];
    if (!entry) {
      this.refill();
      const fallback = this.queue.shift();
      if (!fallback) throw new Error('Banco de questoes vazio.');
      return fallback.question;
    }
    this.queue.splice(index, 1);
    return entry.question;
  }

  /** Primeiro item do nivel alvo; se o nivel acabou, o nivel mais proximo. */
  private findByLevel(target: 1 | 2 | 3): number {
    const exact = this.queue.findIndex((entry) => entry.question.level === target);
    if (exact >= 0) return exact;

    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    this.queue.forEach((entry, index) => {
      const distance = Math.abs(entry.question.level - target);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  /** Erro: a questao volta para uma posicao entre 3 e 6 a frente na fila. */
  requeue(question: Question): void {
    const span = REQUEUE_WINDOW.MAX - REQUEUE_WINDOW.MIN + 1;
    const position = REQUEUE_WINDOW.MIN + Math.floor(this.rng() * span);
    const clamped = Math.min(Math.max(position, REQUEUE_WINDOW.MIN), REQUEUE_WINDOW.MAX);
    const index = Math.min(clamped - 1, this.queue.length);
    this.queue.splice(index, 0, { question, forced: true });
  }
}
