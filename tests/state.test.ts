import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { createRng } from '../src/game/board';
import {
  applyAnswer,
  canTransition,
  createInitialState,
  pause,
  resolveFeedback,
  restart,
  startCountdown,
  tick,
  transition,
} from '../src/game/state';
import { length } from '../src/game/snake';
import type { AttemptLog, GameState } from '../src/types';

const rng = () => 0.5;

function running(overrides: Partial<GameState> = {}): GameState {
  const base = createInitialState(rng);
  return { ...base, phase: 'running', ...overrides };
}

function asking(overrides: Partial<GameState> = {}): GameState {
  return running({ phase: 'question', ...overrides });
}

const correctLog: AttemptLog = {
  questionId: 'q1',
  focus: 'simple-past',
  correct: true,
  chosen: 'watched',
  elapsedMs: 1000,
};

const wrongLog: AttemptLog = { ...correctLog, correct: false, chosen: 'had watched' };
const timeoutLog: AttemptLog = {
  ...correctLog,
  correct: false,
  chosen: null,
  elapsedMs: CONFIG.QUESTION_TIME_MS,
};

describe('state — pontuacao', () => {
  it('acerto: +10 pontos, +1 comprimento, streak incrementa', () => {
    const before = asking();
    const after = applyAnswer(before, correctLog);
    expect(after.phase).toBe('feedback');
    expect(after.stats.score).toBe(CONFIG.POINTS_PER_CORRECT);
    expect(length(after.snake)).toBe(length(before.snake) + 1);
    expect(after.stats.streak).toBe(1);
    expect(after.stats.correctCount).toBe(1);
  });

  it('acerto acelera o jogo respeitando o piso', () => {
    let state = asking();
    const first = applyAnswer(state, correctLog);
    expect(first.tickMs).toBe(CONFIG.INITIAL_TICK_MS - CONFIG.TICK_DECREMENT_MS);

    state = asking({ tickMs: CONFIG.MIN_TICK_MS });
    expect(applyAnswer(state, correctLog).tickMs).toBe(CONFIG.MIN_TICK_MS);
  });

  it('bonus a cada 3 acertos consecutivos', () => {
    let state = asking();
    for (let i = 0; i < 3; i += 1) {
      state = applyAnswer({ ...state, phase: 'question' }, correctLog);
    }
    expect(state.stats.streak).toBe(3);
    expect(state.stats.score).toBe(
      CONFIG.POINTS_PER_CORRECT * 3 + CONFIG.STREAK_BONUS_POINTS,
    );
  });

  it('erro: pontuacao inalterada, -1 comprimento, streak zera', () => {
    const before = applyAnswer(asking(), correctLog);
    const scoreBefore = before.stats.score;
    const after = applyAnswer({ ...before, phase: 'question' }, wrongLog);
    expect(after.stats.score).toBe(scoreBefore);
    expect(length(after.snake)).toBe(length(before.snake) - 1);
    expect(after.stats.streak).toBe(0);
    expect(after.stats.wrongCount).toBe(1);
  });

  it('erro nao altera a velocidade', () => {
    const state = asking({ tickMs: 120 });
    expect(applyAnswer(state, wrongLog).tickMs).toBe(120);
  });

  it('estouro de tempo e tratado como erro, com chosen null', () => {
    const after = applyAnswer(asking(), timeoutLog);
    expect(after.stats.wrongCount).toBe(1);
    expect(after.stats.score).toBe(0);
    expect(after.attempts[0]?.chosen).toBeNull();
    expect(after.attempts[0]?.correct).toBe(false);
  });

  it('erro com comprimento 3 leva a gameover com motivo too-short', () => {
    const state = asking();
    expect(length(state.snake)).toBe(CONFIG.MIN_LENGTH);
    const feedback = applyAnswer(state, wrongLog);
    expect(feedback.phase).toBe('feedback');
    const resolved = resolveFeedback(feedback, rng, 10);
    expect(resolved.phase).toBe('gameover');
    expect(resolved.gameOverReason).toBe('too-short');
  });

  it('feedback com comprimento suficiente volta para a contagem', () => {
    const state = applyAnswer(asking(), correctLog);
    const resolved = resolveFeedback(state, createRng(7), 10);
    expect(resolved.phase).toBe('countdown');
    expect(resolved.snake.pending).toEqual([]);
  });

  it('registra cada tentativa no relatorio', () => {
    let state = applyAnswer(asking(), correctLog);
    state = applyAnswer({ ...state, phase: 'question' }, wrongLog);
    expect(state.attempts.length).toBe(2);
  });
});

describe('state — maquina de estados', () => {
  it('aceita apenas as transicoes da especificacao', () => {
    expect(canTransition('idle', 'countdown')).toBe(true);
    expect(canTransition('countdown', 'running')).toBe(true);
    expect(canTransition('running', 'paused')).toBe(true);
    expect(canTransition('paused', 'countdown')).toBe(true);
    expect(canTransition('running', 'question')).toBe(true);
    expect(canTransition('question', 'feedback')).toBe(true);
    expect(canTransition('feedback', 'countdown')).toBe(true);
    expect(canTransition('feedback', 'gameover')).toBe(true);
    expect(canTransition('running', 'gameover')).toBe(true);
    expect(canTransition('gameover', 'idle')).toBe(true);
  });

  it('ignora transicoes invalidas sem lancar erro', () => {
    const state = createInitialState(rng);
    expect(transition(state, 'running').phase).toBe('idle');
    expect(transition(state, 'gameover').phase).toBe('idle');
    expect(transition({ ...state, phase: 'paused' }, 'running').phase).toBe('paused');
    expect(transition({ ...state, phase: 'question' }, 'paused').phase).toBe('question');
    expect(transition({ ...state, phase: 'gameover' }, 'running').phase).toBe('gameover');
  });

  it('pausar so funciona a partir de running e limpa o buffer', () => {
    const state = running({
      snake: { ...createInitialState(rng).snake, pending: ['up'] },
    });
    const paused = pause(state);
    expect(paused.phase).toBe('paused');
    expect(paused.snake.pending).toEqual([]);
    expect(pause({ ...state, phase: 'question' }).phase).toBe('question');
  });

  it('applyAnswer fora de question e ignorado', () => {
    const state = running();
    expect(applyAnswer(state, correctLog)).toBe(state);
  });

  it('startCountdown a partir de idle registra o inicio', () => {
    const state = startCountdown(createInitialState(rng), 500);
    expect(state.phase).toBe('countdown');
    expect(state.startedAt).toBe(500);
  });

  it('restart so funciona a partir de gameover', () => {
    const over = { ...running(), phase: 'gameover' as const };
    expect(restart(over, rng, 1).phase).toBe('idle');
    const alive = running();
    expect(restart(alive, rng, 1)).toBe(alive);
  });
});

describe('state — tick', () => {
  it('so anda em running', () => {
    const state = { ...running(), phase: 'paused' as const };
    expect(tick(state, 0)).toBe(state);
  });

  it('bate na parede e termina o jogo', () => {
    const state = running({
      snake: {
        segments: [{ x: CONFIG.GRID_COLS - 1, y: 5 }],
        direction: 'right',
        pending: [],
      },
    });
    const after = tick(state, 99);
    expect(after.phase).toBe('gameover');
    expect(after.gameOverReason).toBe('wall');
    expect(after.endedAt).toBe(99);
  });

  it('bate no proprio corpo e termina o jogo', () => {
    const state = running({
      snake: {
        segments: [
          { x: 5, y: 5 },
          { x: 4, y: 5 },
          { x: 4, y: 4 },
          { x: 5, y: 4 },
          { x: 6, y: 4 },
        ],
        direction: 'right',
        pending: ['up'],
      },
    });
    const after = tick(state, 1);
    expect(after.phase).toBe('gameover');
    expect(after.gameOverReason).toBe('self');
  });

  it('comer a fruta congela o jogo em question sem crescer', () => {
    const state = running({
      snake: { segments: [{ x: 5, y: 5 }], direction: 'right', pending: [] },
      fruit: { x: 6, y: 5 },
    });
    const after = tick(state, 1);
    expect(after.phase).toBe('question');
    expect(after.fruitsEaten).toBe(1);
    expect(length(after.snake)).toBe(1);
  });

  it('andar em celula livre mantem running', () => {
    const state = running({
      snake: { segments: [{ x: 5, y: 5 }], direction: 'right', pending: [] },
      fruit: { x: 15, y: 15 },
    });
    const after = tick(state, 1);
    expect(after.phase).toBe('running');
    expect(after.snake.segments[0]).toEqual({ x: 6, y: 5 });
  });
});
