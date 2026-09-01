// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config';
import { loadQuestions } from '../src/quiz/questions';
import { findTopic, includesFocus } from '../src/quiz/topics';
import type { TopicId } from '../src/types';
import type { Direction, Vec } from '../src/types';

/**
 * Contexto 2D falso que registra os retangulos desenhados. O ultimo retangulo
 * de cada quadro e a cabeca da cobra — e o unico jeito de observar a posicao
 * real sem furar o encapsulamento do jogo.
 */
const drawn: Vec[] = [];

function stubCanvas(): void {
  const noop = (): void => undefined;
  const context = {
    setTransform: noop,
    fillRect: noop,
    beginPath: noop,
    moveTo: noop,
    lineTo: noop,
    stroke: noop,
    arc: noop,
    fill: noop,
    roundRect: (x: number, y: number) => {
      drawn.push({
        x: Math.round((x - 1.5) / CONFIG.CELL_SIZE),
        y: Math.round((y - 1.5) / CONFIG.CELL_SIZE),
      });
    },
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 0,
  };
  HTMLCanvasElement.prototype.getContext = (() =>
    context) as unknown as typeof HTMLCanvasElement.prototype.getContext;
}

interface Snapshot {
  head: Vec;
  /** Ordem do renderer: cauda primeiro, cabeca por ultimo. */
  segments: Vec[];
}

/** Avanca um quadro e le a cobra inteira pelo que foi desenhado no canvas. */
function readSnake(): Snapshot | null {
  drawn.length = 0;
  vi.advanceTimersByTime(16);
  const segments = [...drawn];
  const head = segments[segments.length - 1];
  return head ? { head, segments } : null;
}

function frames(count: number): void {
  for (let i = 0; i < count; i += 1) vi.advanceTimersByTime(16);
}

function key(code: string, target: EventTarget = window): void {
  target.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true }));
}

const ARROW: Record<Direction, string> = {
  up: 'ArrowUp',
  down: 'ArrowDown',
  left: 'ArrowLeft',
  right: 'ArrowRight',
};

const OPPOSITE: Record<Direction, Direction> = {
  up: 'down',
  down: 'up',
  left: 'right',
  right: 'left',
};

function text(): string {
  return document.body.textContent ?? '';
}

function modalOpen(): boolean {
  return document.querySelector<HTMLElement>('.backdrop')?.hidden === false;
}

function gameOver(): boolean {
  return text().includes('Fim de jogo');
}

/** Serpentina que cobre o tabuleiro inteiro: a fruta esta em alguma dessas celulas. */
function sweepWaypoints(): Vec[] {
  const path: Vec[] = [
    { x: 10, y: 1 },
    { x: 0, y: 1 },
    { x: 0, y: 0 },
  ];
  for (let row = 0; row < CONFIG.GRID_ROWS; row += 1) {
    const rightward = row % 2 === 0;
    path.push({ x: rightward ? CONFIG.GRID_COLS - 1 : 0, y: row });
    if (row < CONFIG.GRID_ROWS - 1) {
      path.push({ x: rightward ? CONFIG.GRID_COLS - 1 : 0, y: row + 1 });
    }
  }
  return path;
}

/** Dirige a cobra pela serpentina ate ela comer, lendo a cabeca a cada quadro. */
function driveUntilQuestion(): void {
  let facing: Direction = 'right';
  const path = sweepWaypoints();
  let index = 0;

  for (let frame = 0; frame < 12_000; frame += 1) {
    if (modalOpen()) return;
    if (gameOver()) {
      throw new Error(
        `a cobra morreu durante a varredura: ${document.querySelector('.panel__lead')?.textContent} (quadro ${frame})`,
      );
    }
    const snake = readSnake();
    if (!snake) continue;
    const head = snake.head;

    let target = path[index];
    if (!target) {
      index = 0;
      target = path[0] as Vec;
    }
    if (head.x === target.x && head.y === target.y) {
      index = (index + 1) % path.length;
      target = path[index] as Vec;
    }

    const desired = chooseDirection(snake, target, facing);
    if (desired && desired !== facing) {
      key(ARROW[desired]);
      facing = desired;
    }
  }
  throw new Error('a cobra nao chegou na fruta');
}

function stepTo(position: Vec, direction: Direction): Vec {
  return {
    x: position.x + (direction === 'right' ? 1 : direction === 'left' ? -1 : 0),
    y: position.y + (direction === 'down' ? 1 : direction === 'up' ? -1 : 0),
  };
}

/**
 * Direcao segura: nao inverte 180 graus, nao sai do tabuleiro e nao entra no
 * proprio corpo. A cauda nao conta — ela deixa a celula no mesmo passo.
 */
function chooseDirection(
  snake: Snapshot,
  target: Vec,
  facing: Direction,
): Direction | null {
  const body = snake.segments.slice(1);

  const safe = (direction: Direction | null): direction is Direction => {
    if (direction === null || direction === OPPOSITE[facing]) return false;
    const next = stepTo(snake.head, direction);
    if (
      next.x < 0 ||
      next.y < 0 ||
      next.x >= CONFIG.GRID_COLS ||
      next.y >= CONFIG.GRID_ROWS
    ) {
      return false;
    }
    return !body.some((segment) => segment.x === next.x && segment.y === next.y);
  };

  const horizontal: Direction | null =
    target.x > snake.head.x ? 'right' : target.x < snake.head.x ? 'left' : null;
  const vertical: Direction | null =
    target.y > snake.head.y ? 'down' : target.y < snake.head.y ? 'up' : null;

  if (safe(horizontal)) return horizontal;
  if (safe(vertical)) return vertical;
  // Encurralado no eixo do alvo: sai da linha por um passo, para onde der.
  const alternatives: Direction[] = ['up', 'down', 'left', 'right'];
  return alternatives.find(safe) ?? null;
}

function optionText(button: HTMLButtonElement): string {
  // O textContent do botao comeca com o numero do atalho; a alternativa e o
  // ultimo no filho. Comparar o texto inteiro confundiria "started" com
  // "had started".
  return button.lastChild?.textContent ?? '';
}

/** Le o gabarito da questao aberta e responde certo ou errado. */
function answerQuestion(correct: boolean): void {
  expect(modalOpen(), 'o modal da pergunta precisa estar aberto').toBe(true);
  const sentence = document.querySelector('.sentence')?.textContent ?? '';
  const question = loadQuestions().find((item) => item.sentence === sentence);
  if (!question) throw new Error(`questao nao encontrada: "${sentence}"`);
  const answer = question.options[question.answerIndex] ?? '';

  const options = Array.from(document.querySelectorAll<HTMLButtonElement>('.option'));
  expect(options.length).toBe(4);
  const target = options.find((option) =>
    correct ? optionText(option) === answer : optionText(option) !== answer,
  );
  if (!target) throw new Error('alternativa nao encontrada');

  target.click();
  key('Enter', document.querySelector('.backdrop') ?? window);
  vi.advanceTimersByTime(CONFIG.FEEDBACK_MS + 50);
  frames(2);
}

/**
 * Avanca so ate a contagem regressiva acabar. Passar disso deixaria a cobra
 * andar sem comando — e ela pode estar encostada na parede.
 */
/** Marca um conteudo no menu da tela inicial. */
function pickTopic(label: string): void {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>('.choices--topics .choice'),
  ).find((node) => node.querySelector('.choice__label')?.textContent === label);
  if (!button) throw new Error(`conteudo nao encontrado no menu: ${label}`);
  button.click();
}

/** Tempo verbal da questao que esta aberta no modal. */
function openQuestionFocus(): string {
  const sentence = document.querySelector('.sentence')?.textContent ?? '';
  const question = loadQuestions().find((item) => item.sentence === sentence);
  if (!question) throw new Error(`questao nao encontrada: "${sentence}"`);
  return question.focus;
}

function startGame(): void {
  document.querySelector<HTMLButtonElement>('.button--primary')?.click();
  skipCountdown();
}

function skipCountdown(): void {
  let seen = false;
  for (let frame = 0; frame < 400; frame += 1) {
    const showing = document.querySelector('.countdown') !== null;
    if (showing) seen = true;
    else if (seen) return;
    else if (frame > 60) return;
    vi.advanceTimersByTime(16);
  }
  throw new Error('a contagem regressiva nao terminou');
}

function hudCell(index: number): string {
  return document.querySelectorAll('.hud__cell')[index]?.textContent ?? '';
}

beforeEach(async () => {
  vi.resetModules();
  vi.useFakeTimers({
    toFake: [
      'setTimeout',
      'clearTimeout',
      'setInterval',
      'clearInterval',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'performance',
      'Date',
    ],
  });
  window.localStorage.clear();
  document.body.replaceChildren();
  const app = document.createElement('div');
  app.id = 'app';
  document.body.append(app);
  drawn.length = 0;
  stubCanvas();
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
  })) as unknown as typeof window.matchMedia;
  await import('../src/main');
});

afterEach(() => {
  vi.useRealTimers();
});

describe('app — boot', () => {
  it('monta HUD, tabuleiro e tela inicial', () => {
    expect(document.querySelector('canvas')).not.toBeNull();
    expect(document.querySelector('.hud')?.textContent).toContain('Pontos');
    expect(text()).toContain('Comecar');
    expect(text()).toContain('Recorde atual: 0 pontos');
  });

  it('o canvas tem aria-label descritivo e o HUD e texto no DOM', () => {
    expect(document.querySelector('canvas')?.getAttribute('aria-label')).toContain(
      'Tabuleiro 20 por 20',
    );
    expect(document.querySelector('.hud')?.getAttribute('aria-live')).toBe('polite');
  });

  it('Enter comeca a partida pela contagem regressiva', () => {
    key('Enter');
    frames(2);
    expect(document.querySelector('.countdown')?.textContent).toBe('3');
    skipCountdown();
    expect(document.querySelector('.countdown')).toBeNull();
  });
});

describe('app — partida completa', () => {
  beforeEach(() => {
    document.querySelector<HTMLButtonElement>('.button--primary')?.click();
    skipCountdown();
  });

  it('come a fruta, congela o jogo e abre a pergunta', () => {
    driveUntilQuestion();
    expect(modalOpen()).toBe(true);
    expect(document.querySelector('.modal')?.getAttribute('aria-modal')).toBe('true');
    expect(document.querySelector('.sentence')?.textContent).toContain('___');
    expect(document.querySelectorAll('.option').length).toBe(4);
  });

  it('acertar pontua, cresce e volta pela contagem regressiva', () => {
    driveUntilQuestion();
    answerQuestion(true);

    expect(hudCell(0)).toContain(String(CONFIG.POINTS_PER_CORRECT));
    expect(hudCell(1)).toContain('4');
    expect(hudCell(2)).toContain('1 / 0');
    expect(document.querySelector('.countdown')).not.toBeNull();
  });

  it('errar com 3 segmentos encerra a partida e abre o relatorio', () => {
    driveUntilQuestion();
    answerQuestion(false);

    expect(gameOver()).toBe(true);
    expect(text()).toContain('A cobra ficou curta demais.');
    expect(text()).toContain('Para revisar');
    expect(document.querySelectorAll('.missed__item').length).toBe(1);
    expect(text()).toContain('Precisao');
    expect(text()).toContain('Past Perfect');
  });

  it('grava o recorde e reinicia com Jogar de novo', () => {
    // Um acerto leva a cobra a 4 segmentos; o erro seguinte tira 2 e mata.
    driveUntilQuestion();
    answerQuestion(true);
    skipCountdown();
    driveUntilQuestion();
    answerQuestion(false);

    expect(gameOver()).toBe(true);
    expect(window.localStorage.getItem(CONFIG.STORAGE_KEY)).toContain('"bestScore":10');

    const again = Array.from(
      document.querySelectorAll<HTMLButtonElement>('.panel__actions button'),
    )[0];
    again?.click();
    expect(text()).toContain('Comecar');
    expect(hudCell(0)).toContain('0');
    expect(hudCell(3)).toContain('10');
  });

  it('pausa por tecla e por troca de aba', () => {
    key('Space');
    expect(text()).toContain('Jogo pausado');
    document.querySelector<HTMLButtonElement>('.button--primary')?.click();
    skipCountdown();
    expect(text()).not.toContain('Jogo pausado');

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(text()).toContain('Jogo pausado');
  });
});

describe('app — menu de conteudo', () => {
  it('mostra os cinco conteudos com a contagem real de frases', () => {
    const group = document.querySelector('.choices--topics');
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
    expect(group?.textContent).toContain(`${loadQuestions().length} frases`);
  });

  it.each<[string, TopicId]>([
    ['Futuro', 'future'],
    ['Presente', 'present'],
    ['Passado', 'past'],
  ])('escolher %s so traz questoes desse conteudo', (label, id) => {
    pickTopic(label);
    startGame();

    const topic = findTopic(id);
    for (let round = 0; round < 3; round += 1) {
      driveUntilQuestion();
      const focus = openQuestionFocus();
      expect(includesFocus(topic, focus as never), `${label}: caiu ${focus}`).toBe(true);
      answerQuestion(true);
      skipCountdown();
    }
  });

  it('o relatorio final registra o conteudo escolhido', () => {
    pickTopic('Futuro');
    startGame();
    driveUntilQuestion();
    answerQuestion(false);

    expect(gameOver()).toBe(true);
    expect(text()).toContain('Conteudo: Futuro');
  });

  it('sem escolher nada, joga o conteudo original', () => {
    startGame();
    driveUntilQuestion();
    expect(['simple-past', 'past-perfect', 'contrast']).toContain(openQuestionFocus());
  });
});
