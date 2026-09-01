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
    showFullscreenHint: false,
    ...overrides,
  };
}

let root: HTMLElement;
let overlays: Overlays;
const calls = {
  start: [] as Array<{ mode: string; topic: string; nick: string }>,
  resume: 0,
  restart: 0,
  hintDone: 0,
};

beforeEach(() => {
  document.body.replaceChildren();
  root = document.createElement('div');
  root.hidden = true;
  document.body.append(root);
  calls.start = [];
  calls.resume = 0;
  calls.restart = 0;
  calls.hintDone = 0;
  overlays = new Overlays(root, {
    onStart: (mode, topic, nick) => calls.start.push({ mode, topic, nick }),
    onResume: () => (calls.resume += 1),
    onRestart: () => (calls.restart += 1),
    onFullscreenHintDone: () => (calls.hintDone += 1),
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

describe('overlays — convite de tela cheia', () => {
  it('aparece na primeira visita, antes do apelido', () => {
    overlays.showIdle(idleView({ showFullscreenHint: true }));
    const hint = root.querySelector('.fs-hint');
    expect(hint).not.toBeNull();
    expect(hint?.getAttribute('role')).toBe('note');
    expect(hint?.textContent).toContain('tela cheia');
    // Vem antes do campo de apelido, onde o aluno olha primeiro.
    const campo = root.querySelector('.nick');
    expect(hint?.compareDocumentPosition(campo as Node)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING,
    );
  });

  it('nao aparece quando ja foi visto', () => {
    overlays.showIdle(idleView({ showFullscreenHint: false }));
    expect(root.querySelector('.fs-hint')).toBeNull();
  });

  it('ensina como sair, para o aluno nao se sentir preso', () => {
    overlays.showIdle(idleView({ showFullscreenHint: true }));
    const texto = root.querySelector('.fs-hint__text')?.textContent ?? '';
    expect(texto).toContain('Esc');
    expect(texto).toContain('F');
  });

  it('"Agora nao" fecha o convite e avisa que foi respondido', () => {
    overlays.showIdle(idleView({ showFullscreenHint: true }));
    root.querySelector<HTMLButtonElement>('.fs-hint__dismiss')?.click();
    expect(root.querySelector('.fs-hint')).toBeNull();
    expect(calls.hintDone).toBe(1);
  });

  it('"Jogar em tela cheia" pede tela cheia e fecha o convite', async () => {
    const pedido = vi.fn(() => Promise.resolve());
    Object.defineProperty(document, 'fullscreenEnabled', {
      value: true,
      configurable: true,
    });
    Object.defineProperty(document, 'fullscreenElement', {
      value: null,
      configurable: true,
    });
    document.documentElement.requestFullscreen = pedido;

    overlays.showIdle(idleView({ showFullscreenHint: true }));
    root.querySelector<HTMLButtonElement>('.fs-hint__accept')?.click();

    await vi.waitFor(() => expect(calls.hintDone).toBe(1));
    expect(pedido).toHaveBeenCalled();
    expect(root.querySelector('.fs-hint')).toBeNull();
  });

  it('nao rouba o foco: o campo de apelido continua recebendo', () => {
    overlays.showIdle(idleView({ showFullscreenHint: true, nick: '' }));
    expect(document.activeElement).toBe(root.querySelector('.nick__field'));
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

  it('a unica acao do fim de jogo e jogar de novo', () => {
    const buttons = Array.from(
      root.querySelectorAll<HTMLButtonElement>('.panel__actions button'),
    );
    expect(buttons.map((b) => b.textContent)).toEqual(['Jogar de novo']);
    buttons[0]?.click();
    expect(calls.restart).toBe(1);
  });

  it('nao ha mais botoes de copiar', () => {
    expect(root.textContent).not.toContain('Copiar');
  });
});
