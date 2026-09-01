// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config';
import { QuestionModal, type AnswerResult } from '../src/ui/questionModal';
import type { PresentedQuestion } from '../src/quiz/selector';
import type { Question } from '../src/types';

const question: Question = {
  id: 'pp-001',
  level: 1,
  focus: 'past-perfect',
  sentence: 'By the time we arrived, the concert ___.',
  verbHint: 'finish',
  options: ['had finished', 'finishes', 'has finished', 'was finishing'],
  answerIndex: 0,
  accepted: ['had finished', "'d finished"],
  explanation: 'By the time pede Past Perfect.',
};

const presented: PresentedQuestion = {
  question,
  options: ['finishes', 'had finished', 'has finished', 'was finishing'],
  answerIndex: 1,
};

let root: HTMLElement;
let answered: AnswerResult[];
let dismissed: number;
let modal: QuestionModal;

function press(key: string, code = key): void {
  const target = document.querySelector('.backdrop');
  target?.dispatchEvent(new KeyboardEvent('keydown', { key, code, bubbles: true }));
}

function options(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>('.option'));
}

beforeEach(() => {
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'Date',
    ],
  });
  document.body.replaceChildren();
  root = document.createElement('div');
  document.body.append(root);
  answered = [];
  dismissed = 0;
  modal = new QuestionModal(root, {
    onAnswered: (result) => answered.push(result),
    onDismissed: () => (dismissed += 1),
  });
});

afterEach(() => {
  modal.destroy();
  vi.useRealTimers();
});

describe('questionModal — estrutura e acessibilidade', () => {
  it('abre como dialogo modal com a frase e a lacuna', () => {
    modal.open(presented, 'choice');
    const dialog = document.querySelector('.question-modal');
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('.sentence')?.textContent).toBe(question.sentence);
    expect(document.querySelector('.gap')?.textContent).toBe('___');
  });

  it('mostra o verbo entre parenteses e as 4 alternativas', () => {
    modal.open(presented, 'choice');
    expect(document.querySelector('.hint')?.textContent).toContain('finish');
    expect(options().length).toBe(4);
  });

  it('anuncia o feedback em aria-live assertivo', () => {
    modal.open(presented, 'choice');
    expect(document.querySelector('.feedback')?.getAttribute('aria-live')).toBe(
      'assertive',
    );
  });

  it('Esc nao fecha o modal', () => {
    modal.open(presented, 'choice');
    press('Escape');
    expect(document.querySelector<HTMLElement>('.backdrop')?.hidden).toBe(false);
    expect(answered.length).toBe(0);
  });
});

describe('questionModal — multipla escolha', () => {
  it('teclas 1 a 4 marcam a alternativa', () => {
    modal.open(presented, 'choice');
    press('3', 'Digit3');
    expect(options()[2]?.getAttribute('aria-pressed')).toBe('true');
    expect(options()[0]?.getAttribute('aria-pressed')).toBe('false');
  });

  it('setas navegam entre as alternativas', () => {
    modal.open(presented, 'choice');
    press('ArrowDown');
    press('ArrowDown');
    expect(options()[1]?.classList.contains('option--selected')).toBe(true);
  });

  it('Enter confirma e acerta a alternativa certa', () => {
    modal.open(presented, 'choice');
    press('2', 'Digit2');
    press('Enter');
    expect(answered[0]?.correct).toBe(true);
    expect(answered[0]?.chosen).toBe('had finished');
  });

  it('Enter sem selecao nao envia nada', () => {
    modal.open(presented, 'choice');
    press('Enter');
    expect(answered.length).toBe(0);
  });

  it('marca a errada e mostra a correta encaixada na lacuna', () => {
    modal.open(presented, 'choice');
    press('1', 'Digit1');
    press('Enter');
    expect(answered[0]?.correct).toBe(false);
    expect(document.querySelector('.gap')?.textContent).toBe('had finished');
    expect(document.querySelector('.gap')?.classList.contains('gap--ok')).toBe(false);
    expect(options()[1]?.classList.contains('option--ok')).toBe(true);
    expect(options()[0]?.classList.contains('option--err')).toBe(true);
  });

  it('acertar encaixa o verbo na lacuna com a cor de acerto', () => {
    modal.open(presented, 'choice');
    press('2', 'Digit2');
    press('Enter');
    const gap = document.querySelector('.gap');
    expect(gap?.textContent).toBe('had finished');
    expect(gap?.classList.contains('gap--ok')).toBe(true);
  });

  it('fecha o modal depois do tempo de feedback', () => {
    modal.open(presented, 'choice');
    press('2', 'Digit2');
    press('Enter');
    expect(dismissed).toBe(0);
    vi.advanceTimersByTime(CONFIG.FEEDBACK_MS + 10);
    expect(dismissed).toBe(1);
    expect(document.querySelector<HTMLElement>('.backdrop')?.hidden).toBe(true);
  });

  it('nao aceita segunda resposta depois de respondida', () => {
    modal.open(presented, 'choice');
    press('2', 'Digit2');
    press('Enter');
    press('1', 'Digit1');
    press('Enter');
    expect(answered.length).toBe(1);
  });
});

describe('questionModal — modo digitado', () => {
  it('foca o campo e aceita a contracao', () => {
    modal.open(presented, 'typed');
    const input = document.querySelector<HTMLInputElement>('.typed');
    expect(input).not.toBeNull();
    expect(document.activeElement).toBe(input);
    if (!input) return;
    input.value = "'d finished";
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(answered[0]?.correct).toBe(true);
  });

  it('recusa outro verbo', () => {
    modal.open(presented, 'typed');
    const input = document.querySelector<HTMLInputElement>('.typed');
    if (!input) throw new Error('campo nao encontrado');
    input.value = 'had ended';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(answered[0]?.correct).toBe(false);
  });
});

describe('questionModal — cronometro', () => {
  it('estourar o tempo conta como erro com chosen null', () => {
    modal.open(presented, 'choice');
    vi.advanceTimersByTime(CONFIG.QUESTION_TIME_MS + 100);
    expect(answered[0]?.correct).toBe(false);
    expect(answered[0]?.chosen).toBeNull();
    expect(document.querySelector('.feedback')?.textContent).toContain('Tempo esgotado');
  });
});
