// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Overlays } from '../src/ui/overlays';
import type { Report } from '../src/ui/report';

const report: Report = {
  score: 40,
  bestScore: 120,
  finalLength: 2,
  durationMs: 95_000,
  correct: 4,
  wrong: 2,
  accuracy: 67,
  byFocus: [
    { focus: 'simple-past', correct: 3, wrong: 0 },
    { focus: 'past-perfect', correct: 1, wrong: 2 },
    { focus: 'contrast', correct: 0, wrong: 0 },
  ],
  missed: [
    {
      sentence: 'By the time we arrived, the concert had finished.',
      chosen: 'has finished',
      answer: 'had finished',
      explanation: 'By the time pede Past Perfect.',
      focus: 'past-perfect',
    },
    {
      sentence: 'The room was empty. Everybody had gone home.',
      chosen: null,
      answer: 'had gone',
      explanation: 'Acao anterior a outro momento passado.',
      focus: 'past-perfect',
    },
  ],
  reason: 'too-short',
};

let root: HTMLElement;
let overlays: Overlays;
const calls = { start: [] as string[], resume: 0, restart: 0, copy: 0 };

beforeEach(() => {
  document.body.replaceChildren();
  root = document.createElement('div');
  root.hidden = true;
  document.body.append(root);
  calls.start = [];
  calls.resume = 0;
  calls.restart = 0;
  calls.copy = 0;
  overlays = new Overlays(root, {
    onStart: (mode) => calls.start.push(mode),
    onResume: () => (calls.resume += 1),
    onRestart: () => (calls.restart += 1),
    onCopyReport: () => {
      calls.copy += 1;
      return Promise.resolve(true);
    },
  });
});

describe('overlays — tela inicial', () => {
  it('mostra o recorde e comeca em multipla escolha', () => {
    overlays.showIdle(120);
    expect(root.hidden).toBe(false);
    expect(root.textContent).toContain('Recorde atual: 120 pontos');
    expect(overlays.answerMode).toBe('choice');
  });

  it('permite trocar para o modo digitado antes de comecar', () => {
    overlays.showIdle(0);
    const typed = Array.from(root.querySelectorAll<HTMLButtonElement>('.mode')).find(
      (button) => button.textContent === 'Digitando',
    );
    typed?.click();
    expect(overlays.answerMode).toBe('typed');
    expect(typed?.getAttribute('aria-checked')).toBe('true');

    root.querySelector<HTMLButtonElement>('.button--primary')?.click();
    expect(calls.start).toEqual(['typed']);
  });
});

describe('overlays — pausa e contagem', () => {
  it('a pausa oferece continuar', () => {
    overlays.showPaused();
    expect(root.textContent).toContain('Jogo pausado');
    root.querySelector<HTMLButtonElement>('.button--primary')?.click();
    expect(calls.resume).toBe(1);
  });

  it('a contagem regressiva mostra o numero e some do leitor de tela', () => {
    overlays.showCountdown(3);
    const countdown = root.querySelector('.countdown');
    expect(countdown?.textContent).toBe('3');
    expect(countdown?.getAttribute('aria-hidden')).toBe('true');
  });

  it('esconder limpa o conteudo', () => {
    overlays.showPaused();
    overlays.hide();
    expect(root.hidden).toBe(true);
    expect(root.textContent).toBe('');
  });
});

describe('overlays — relatorio final', () => {
  beforeEach(() => overlays.showGameOver(report));

  it('explica o motivo do fim de jogo', () => {
    expect(root.textContent).toContain('A cobra ficou curta demais.');
  });

  it('mostra pontuacao, recorde, comprimento, tempo e precisao', () => {
    const text = root.textContent ?? '';
    expect(text).toContain('40');
    expect(text).toContain('120');
    expect(text).toContain('1min 35s');
    expect(text).toContain('67%');
    expect(text).toContain('4 / 2');
  });

  it('separa o desempenho por tempo verbal', () => {
    const rows = Array.from(root.querySelectorAll('.focus-table__list li')).map(
      (li) => li.textContent ?? '',
    );
    expect(rows.length).toBe(3);
    expect(rows[0]).toContain('Simple Past');
    expect(rows[1]).toContain('Past Perfect1 certas, 2 erradas');
  });

  it('lista as frases erradas com resposta certa e explicacao', () => {
    const items = Array.from(root.querySelectorAll('.missed__item'));
    expect(items.length).toBe(2);
    expect(items[0]?.textContent).toContain('had finished');
    expect(items[0]?.textContent).toContain('Voce marcou: has finished');
    expect(items[0]?.textContent).toContain('By the time pede Past Perfect.');
    expect(items[1]?.textContent).toContain('Voce nao respondeu a tempo.');
  });

  it('tem os botoes de jogar de novo e copiar relatorio', async () => {
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('.panel__actions button'));
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Jogar de novo',
      'Copiar relatorio',
    ]);
    buttons[0]?.click();
    expect(calls.restart).toBe(1);

    buttons[1]?.click();
    await vi.waitFor(() => expect(buttons[1]?.textContent).toBe('Relatorio copiado'));
    expect(calls.copy).toBe(1);
  });
});
