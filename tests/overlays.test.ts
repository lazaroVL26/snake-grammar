// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Overlays, type IdleView } from '../src/ui/overlays';
import type { Report } from '../src/ui/report';

const report: Report = {
  nick: 'Ana',
  topicLabel: 'Passado',
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

function idleView(overrides: Partial<IdleView> = {}): IdleView {
  return {
    bestScore: 0,
    nick: 'Ana',
    questionCount: () => 41,
    ...overrides,
  };
}

let root: HTMLElement;
let overlays: Overlays;
const calls = {
  start: [] as Array<{ mode: string; topic: string; nick: string }>,
  resume: 0,
  restart: 0,
  copy: 0,
  copyRanking: 0,
};

beforeEach(() => {
  document.body.replaceChildren();
  root = document.createElement('div');
  root.hidden = true;
  document.body.append(root);
  calls.start = [];
  calls.resume = 0;
  calls.restart = 0;
  calls.copy = 0;
  calls.copyRanking = 0;
  overlays = new Overlays(root, {
    onStart: (mode, topic, nick) => calls.start.push({ mode, topic, nick }),
    onResume: () => (calls.resume += 1),
    onRestart: () => (calls.restart += 1),
    onCopyReport: () => {
      calls.copy += 1;
      return Promise.resolve(true);
    },
    onCopyRanking: () => {
      calls.copyRanking += 1;
      return Promise.resolve(true);
    },
  });
});

describe('overlays — tela inicial', () => {
  it('mostra o recorde e comeca em multipla escolha', () => {
    overlays.showIdle(idleView({ bestScore: 120 }));
    expect(root.hidden).toBe(false);
    expect(root.textContent).toContain('Seu recorde: 120 pontos');
    expect(overlays.answerMode).toBe('choice');
  });

  it('permite trocar para o modo digitado antes de comecar', () => {
    overlays.showIdle(idleView());
    const typed = Array.from(root.querySelectorAll<HTMLButtonElement>('.choice')).find(
      (button) => button.textContent?.startsWith('Digitando'),
    );
    typed?.click();
    expect(overlays.answerMode).toBe('typed');
    expect(typed?.getAttribute('aria-checked')).toBe('true');

    root.querySelector<HTMLButtonElement>('.button--primary')?.click();
    expect(calls.start).toEqual([{ mode: 'typed', topic: 'past-contrast', nick: 'Ana' }]);
  });
});

describe('overlays — apelido e ranking', () => {
  it('mostra o campo de apelido ja preenchido com o nome lembrado', () => {
    overlays.showIdle(idleView({ nick: 'Ana' }));
    const field = root.querySelector<HTMLInputElement>('.nick__field');
    expect(field?.value).toBe('Ana');
    expect(field?.maxLength).toBe(16);
  });

  it('foca o campo quando ainda nao ha apelido', () => {
    overlays.showIdle(idleView({ nick: '' }));
    expect(document.activeElement).toBe(root.querySelector('.nick__field'));
  });

  it('sem apelido, comecar avisa em vez de iniciar', () => {
    overlays.showIdle(idleView({ nick: '' }));
    root.querySelector<HTMLButtonElement>('.button--primary')?.click();
    expect(calls.start).toEqual([]);
    expect(root.querySelector('.nick__warning')?.textContent).toContain(
      'Escreva seu apelido',
    );
    expect(document.activeElement).toBe(root.querySelector('.nick__field'));
  });

  it('Enter no campo de apelido comeca a partida', () => {
    overlays.showIdle(idleView({ nick: '' }));
    const field = root.querySelector<HTMLInputElement>('.nick__field');
    if (!field) throw new Error('campo nao encontrado');
    field.value = '  Duda  ';
    field.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(calls.start).toEqual([
      { mode: 'choice', topic: 'past-contrast', nick: 'Duda' },
    ]);
  });

  it('a tela inicial nao repete o ranking: ele vive na coluna ao lado', () => {
    overlays.showIdle(idleView());
    expect(root.querySelector('.ranking')).toBeNull();
    expect(root.textContent).not.toContain('Ranking de hoje');
  });

  it('o fim de jogo avisa que esta enviando, sem repetir a lista', () => {
    overlays.showGameOver(report);
    expect(root.querySelector('.ranking__position')?.textContent).toContain(
      'Enviando para o ranking',
    );
    expect(root.querySelector('.ranking')).toBeNull();
  });

  it('a colocacao entra quando o servidor responde, sem remontar o painel', () => {
    overlays.showGameOver(report);
    const antes = root.querySelector('.ranking__position');
    overlays.setRankingPosition('2o lugar de 7 partidas hoje.');
    expect(root.querySelector('.ranking__position')?.textContent).toBe(
      '2o lugar de 7 partidas hoje.',
    );
    // Mesmo no: o painel nao foi redesenhado, entao o foco nao se perde.
    expect(root.querySelector('.ranking__position')).toBe(antes);
  });

  it('copiar ranking chama o callback', async () => {
    overlays.showGameOver(report);
    const button = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.panel__actions button'),
    ).find((node) => node.textContent === 'Copiar ranking');
    button?.click();
    await vi.waitFor(() => expect(button?.textContent).toBe('Ranking copiado'));
    expect(calls.copyRanking).toBe(1);
  });
});

describe('overlays — menu de conteudo', () => {
  beforeEach(() =>
    overlays.showIdle(
      idleView({ questionCount: (topic) => (topic === 'all' ? 101 : 41) }),
    ),
  );

  it('lista os cinco conteudos com resumo e quantidade de frases', () => {
    const group = root.querySelector('.choices--topics');
    expect(group?.getAttribute('role')).toBe('radiogroup');
    const labels = Array.from(group?.querySelectorAll('.choice__label') ?? []).map(
      (node) => node.textContent,
    );
    expect(labels).toEqual([
      'Simple Past x Past Perfect',
      'Presente',
      'Passado',
      'Futuro',
      'Todos os tempos',
    ]);
    expect(group?.textContent).toContain('101 frases');
  });

  it('comeca em Simple Past x Past Perfect, o conteudo original', () => {
    expect(overlays.contentTopic).toBe('past-contrast');
    const first = root.querySelector('.choices--topics .choice');
    expect(first?.getAttribute('aria-checked')).toBe('true');
  });

  it('escolher outro conteudo marca so ele e vai junto no comecar', () => {
    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.choices--topics .choice'),
    );
    buttons[3]?.click();
    expect(overlays.contentTopic).toBe('future');
    expect(buttons[3]?.getAttribute('aria-checked')).toBe('true');
    expect(buttons[0]?.getAttribute('aria-checked')).toBe('false');

    root.querySelector<HTMLButtonElement>('.button--primary')?.click();
    expect(calls.start).toEqual([{ mode: 'choice', topic: 'future', nick: 'Ana' }]);
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

  it('explica o motivo do fim de jogo e o conteudo estudado', () => {
    expect(root.textContent).toContain('A cobra ficou curta demais.');
    expect(root.textContent).toContain('Conteudo: Passado');
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
    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.panel__actions button'),
    );
    expect(buttons.map((b) => b.textContent)).toEqual([
      'Jogar de novo',
      'Copiar relatorio',
      'Copiar ranking',
    ]);
    buttons[0]?.click();
    expect(calls.restart).toBe(1);

    buttons[1]?.click();
    await vi.waitFor(() => expect(buttons[1]?.textContent).toBe('Relatorio copiado'));
    expect(calls.copy).toBe(1);
  });
});
