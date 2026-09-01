// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config';
import { loadQuestions } from '../src/quiz/questions';
import { findTopic, includesFocus } from '../src/quiz/topics';
import { dayKey } from '../src/storage/scoreboard';
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

/** Direcao real da cobra, deduzida do desenho: cabeca menos o segmento seguinte. */
function facingOf(snake: Snapshot, fallback: Direction): Direction {
  const neck = snake.segments[snake.segments.length - 2];
  if (!neck) return fallback;
  const dx = snake.head.x - neck.x;
  const dy = snake.head.y - neck.y;
  if (dx > 0) return 'right';
  if (dx < 0) return 'left';
  if (dy > 0) return 'down';
  if (dy < 0) return 'up';
  return fallback;
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
  const path = sweepWaypoints();
  let index = 0;
  let lastKnown: Direction = 'right';

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

    // A direcao vem do desenho, nunca de um palpite acumulado: se uma tecla for
    // recusada pelo jogo, o quadro seguinte corrige sozinho.
    const facing = facingOf(snake, lastKnown);
    lastKnown = facing;
    const desired = chooseDirection(snake, target, facing);
    // Repetir a mesma tecla e inofensivo: o jogo descarta viradas duplicadas.
    if (desired && desired !== facing) key(ARROW[desired]);
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

/** Preenche o apelido: sem ele a partida nao comeca. */
function typeNick(name: string): void {
  const field = document.querySelector<HTMLInputElement>('.nick__field');
  if (!field) throw new Error('campo de apelido nao encontrado');
  field.value = name;
}

function startGame(nickName = 'Ana'): void {
  typeNick(nickName);
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

/** Espera as promessas do ranking resolverem (envio e releitura). */
async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

/** Servidor de mentira: guarda as partidas e responde como o real. */
function fakeServer(): { calls: number } {
  const stored: Array<Record<string, unknown>> = [];
  const state = { calls: 0 };
  vi.stubGlobal(
    'fetch',
    vi.fn((_url: string, init?: RequestInit) => {
      state.calls += 1;
      if (init?.method === 'POST') {
        const body = JSON.parse(String(init.body)) as Record<string, unknown>;
        const entry = { ...body, playedAt: 1_000 + stored.length, date: dayKey() };
        stored.push(entry);
        const board = [...stored].sort(
          (a, b) =>
            Number(b.score) - Number(a.score) || Number(a.playedAt) - Number(b.playedAt),
        );
        return Promise.resolve({
          ok: true,
          status: 201,
          json: () =>
            Promise.resolve({
              today: dayKey(),
              board,
              entry,
              position: board.indexOf(entry) + 1,
            }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ today: dayKey(), board: [...stored] }),
      });
    }),
  );
  return state;
}

beforeEach(async () => {
  vi.resetModules();
  // Sem servidor por padrao: os testes de jogo exercitam o modo offline.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('sem servidor')));
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
  // O jsdom nao tem a Fullscreen API; sem isso o botao nasceria escondido.
  Object.defineProperty(document, 'fullscreenEnabled', {
    value: true,
    configurable: true,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    value: null,
    configurable: true,
  });
  document.documentElement.requestFullscreen = () => Promise.resolve();
  document.exitFullscreen = () => Promise.resolve();
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
  vi.unstubAllGlobals();
});

describe('app — boot', () => {
  it('monta HUD, tabuleiro e tela inicial', () => {
    expect(document.querySelector('canvas')).not.toBeNull();
    expect(document.querySelector('.hud')?.textContent).toContain('Pontos');
    expect(text()).toContain('Comecar');
    expect(text()).toContain('Seu recorde: 0 pontos');
  });

  it('o canvas tem aria-label descritivo e o HUD e texto no DOM', () => {
    expect(document.querySelector('canvas')?.getAttribute('aria-label')).toContain(
      'Tabuleiro 20 por 20',
    );
    expect(document.querySelector('.hud')?.getAttribute('aria-live')).toBe('polite');
  });

  it('Enter comeca a partida pela contagem regressiva', () => {
    typeNick('Ana');
    key('Enter');
    frames(2);
    expect(document.querySelector('.countdown')?.textContent).toBe('3');
    skipCountdown();
    expect(document.querySelector('.countdown')).toBeNull();
  });
});

describe('app — partida completa', () => {
  beforeEach(() => startGame());

  it('come a fruta, congela o jogo e abre a pergunta', () => {
    driveUntilQuestion();
    expect(modalOpen()).toBe(true);
    expect(document.querySelector('.question-modal')?.getAttribute('aria-modal')).toBe(
      'true',
    );
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

describe('app — convite de tela cheia na primeira visita', () => {
  it('aparece ao abrir o jogo pela primeira vez', () => {
    const hint = document.querySelector('.fs-hint');
    expect(hint).not.toBeNull();
    expect(hint?.textContent).toContain('tela cheia');
  });

  it('dispensar guarda a decisao e o convite nao volta na proxima partida', () => {
    document.querySelector<HTMLButtonElement>('.fs-hint__dismiss')?.click();
    expect(document.querySelector('.fs-hint')).toBeNull();
    expect(window.localStorage.getItem(CONFIG.STORAGE_KEY)).toContain(
      '"seenFullscreenHint":true',
    );

    // Uma partida inteira, e de volta a tela inicial: nada de convite de novo.
    startGame('Duda');
    driveUntilQuestion();
    answerQuestion(false);
    document.querySelector<HTMLButtonElement>('.panel__actions button')?.click();
    expect(document.querySelector('.fs-hint')).toBeNull();
  });

  it('aceitar tambem guarda a decisao', async () => {
    const pedido = vi.fn(() => Promise.resolve());
    document.documentElement.requestFullscreen = pedido;
    document.querySelector<HTMLButtonElement>('.fs-hint__accept')?.click();
    await flush();
    expect(pedido).toHaveBeenCalled();
    expect(window.localStorage.getItem(CONFIG.STORAGE_KEY)).toContain(
      '"seenFullscreenHint":true',
    );
  });

  it('nao atrapalha comecar a partida', () => {
    startGame('Ana');
    expect(document.querySelector('.overlay')?.textContent).not.toContain('tela cheia');
  });
});

describe('app — botao de tela cheia', () => {
  it('o botao aparece no cabecalho quando o navegador suporta', () => {
    const button = document.querySelector<HTMLButtonElement>('.fullscreen-toggle');
    expect(button).not.toBeNull();
    expect(button?.closest('.shell__head')).not.toBeNull();
    expect(button?.textContent).toBe('Tela cheia');
  });

  it('a tecla F pede tela cheia para a pagina inteira', () => {
    const pedido = vi.fn(() => Promise.resolve());
    document.documentElement.requestFullscreen = pedido;
    key('KeyF');
    // Sem contagem exata: cada teste reimporta main.ts e os ouvintes de
    // teclado se acumulam no window do jsdom. No jogo real, main roda uma vez.
    expect(pedido).toHaveBeenCalled();
  });

  it('F dentro do campo de apelido escreve, nao maximiza', () => {
    const pedido = vi.fn(() => Promise.resolve());
    document.documentElement.requestFullscreen = pedido;
    const field = document.querySelector<HTMLInputElement>('.nick__field');
    field?.focus();
    field?.dispatchEvent(
      new KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true }),
    );
    expect(pedido).not.toHaveBeenCalled();
  });

  it('a linha de dicas ensina a tecla', () => {
    expect(document.querySelector('.hints')?.textContent).toContain('F abre tela cheia');
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

describe('app — apelido e ranking do dia', () => {
  it('sem apelido a partida nao comeca', () => {
    document.querySelector<HTMLButtonElement>('.button--primary')?.click();
    frames(3);
    expect(text()).toContain('Escreva seu apelido');
    expect(document.querySelector('.countdown')).toBeNull();
  });

  it('a partida terminada entra no ranking com o apelido', async () => {
    startGame('Duda');
    driveUntilQuestion();
    answerQuestion(false);
    await flush();

    expect(gameOver()).toBe(true);
    const mine = document.querySelector('.ranking__row--mine');
    expect(mine?.textContent).toContain('Duda');
    expect(text()).toContain('Primeira partida do dia.');

    const raw = window.localStorage.getItem(CONFIG.SCORE_STORAGE_KEY) ?? '';
    expect(raw).toContain('"nick":"Duda"');
    expect(raw).toContain(`"date":"${dayKey()}"`);
  });

  it('a segunda partida entra no mesmo ranking e ordena por pontuacao', async () => {
    // Primeira partida: erra de cara, fica com 0 ponto.
    startGame('Ana');
    driveUntilQuestion();
    answerQuestion(false);
    await flush();
    document.querySelector<HTMLButtonElement>('.panel__actions button')?.click();

    // Segunda: acerta uma antes de morrer, entao passa a primeira.
    startGame('Bruno');
    driveUntilQuestion();
    answerQuestion(true);
    skipCountdown();
    driveUntilQuestion();
    answerQuestion(false);
    await flush();

    expect(gameOver()).toBe(true);
    const nicks = Array.from(document.querySelectorAll('.ranking__nick')).map(
      (node) => node.textContent,
    );
    expect(nicks).toEqual(['Bruno', 'Ana']);
    expect(text()).toContain('1o lugar de 2 partidas hoje');
  });

  it('o apelido fica lembrado para a partida seguinte', async () => {
    startGame('Duda');
    driveUntilQuestion();
    answerQuestion(false);
    await flush();
    document.querySelector<HTMLButtonElement>('.panel__actions button')?.click();

    const field = document.querySelector<HTMLInputElement>('.nick__field');
    expect(field?.value).toBe('Duda');
  });

  it('a coluna do ranking fica visivel durante a partida, fora do painel', () => {
    startGame('Duda');
    const side = document.querySelector('.rank-side');
    expect(side).not.toBeNull();
    expect(side?.closest('.overlay')).toBeNull();
    expect(side?.closest('.panel')).toBeNull();
    expect(side?.textContent).toContain('Ranking de hoje');
    // Jogando: o painel da tela inicial saiu, mas a coluna continua ali.
    expect(document.querySelector<HTMLElement>('.overlay')?.hidden).toBe(true);
  });

  it('a coluna do ranking continua visivel depois de voltar para a tela inicial', async () => {
    startGame('Duda');
    driveUntilQuestion();
    answerQuestion(false);
    await flush();
    document.querySelector<HTMLButtonElement>('.panel__actions button')?.click();

    const side = document.querySelector('.rank-side');
    expect(side?.textContent).toContain('Ranking de hoje');
    expect(side?.querySelector('.rank-side__date')?.textContent).toBe(dayKey());
    expect(side?.querySelector('.ranking')?.textContent).toContain('Duda');
  });

  it('partidas de ontem nao aparecem no ranking de hoje', async () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    window.localStorage.setItem(
      CONFIG.SCORE_STORAGE_KEY,
      JSON.stringify([
        {
          nick: 'Ontem',
          score: 999,
          accuracy: 100,
          correct: 9,
          wrong: 0,
          topicLabel: 'Futuro',
          playedAt: ontem.getTime(),
          date: dayKey(ontem),
        },
      ]),
    );

    startGame('Duda');
    driveUntilQuestion();
    answerQuestion(false);
    await flush();

    expect(gameOver()).toBe(true);
    const nicks = Array.from(document.querySelectorAll('.ranking__nick')).map(
      (node) => node.textContent,
    );
    expect(nicks).toEqual(['Duda']);
  });
});

describe('app — ranking da turma pelo servidor', () => {
  it('envia a partida ao servidor e mostra a lista que ele devolve', async () => {
    const server = fakeServer();
    startGame('Duda');
    driveUntilQuestion();
    answerQuestion(false);
    await flush();

    expect(server.calls).toBeGreaterThan(0);
    const side = document.querySelector('.rank-side');
    expect(side?.textContent).toContain('Duda');
    expect(side?.textContent).toContain('Toda a turma');
    expect(side?.textContent).not.toContain('Sem conexao');
  });

  it('mostra a colocacao vinda do servidor no fim de jogo', async () => {
    fakeServer();
    startGame('Duda');
    driveUntilQuestion();
    answerQuestion(false);
    await flush();
    expect(text()).toContain('Primeira partida do dia.');
  });

  // Sem partida em curso de proposito: avancar o relogio com a cobra andando
  // acabaria a partida e enviaria pontuacao, poluindo a contagem de chamadas.
  it('a lista se atualiza sozinha enquanto a turma joga', async () => {
    const server = fakeServer();
    await fetch('/api/scores', {
      method: 'POST',
      body: JSON.stringify({
        nick: 'Outro',
        score: 500,
        accuracy: 90,
        correct: 5,
        wrong: 1,
        topicLabel: 'Futuro',
      }),
    });
    const antes = server.calls;

    vi.advanceTimersByTime(5_000);
    await flush();

    expect(server.calls).toBeGreaterThan(antes);
    expect(document.querySelector('.rank-side')?.textContent).toContain('Outro');
    expect(document.querySelector('.rank-side')?.textContent).toContain('Toda a turma');
  });

  it('nao consulta o servidor com a aba escondida, e atualiza ao voltar', async () => {
    const server = fakeServer();
    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      configurable: true,
    });
    const antes = server.calls;

    vi.advanceTimersByTime(20_000);
    await flush();
    expect(server.calls).toBe(antes);

    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      configurable: true,
    });
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await flush();
    expect(server.calls).toBeGreaterThan(antes);
  });

  it('a atualizacao periodica nao cancela o envio da partida', async () => {
    fakeServer();
    startGame('Duda');
    driveUntilQuestion();
    answerQuestion(false);
    // Varios ciclos de atualizacao passam enquanto a resposta nao chegou.
    vi.advanceTimersByTime(30_000);
    await flush();

    const posicao = document.querySelector('.ranking__position')?.textContent ?? '';
    expect(posicao).not.toContain('Enviando');
    expect(posicao).toContain('Primeira partida do dia.');
  });

  it('sem servidor, avisa que a lista e so deste PC', async () => {
    startGame('Duda');
    driveUntilQuestion();
    answerQuestion(false);
    await flush();

    const side = document.querySelector('.rank-side');
    expect(side?.textContent).toContain('Sem conexao com o servidor');
    expect(side?.textContent).toContain('Duda');
    expect(text()).toContain('servidor fora do ar');
  });
});
