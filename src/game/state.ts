import { CONFIG } from '../config';
import type { AttemptLog, GameOverReason, GamePhase, GameState, Rng } from '../types';
import { spawnFruit } from './board';
import { hitsSelf, hitsWall } from './collision';
import { clearQueue, createSnake, grow, head, length, sameCell, shrink, step } from './snake';

const TRANSITIONS: Record<GamePhase, readonly GamePhase[]> = {
  idle: ['countdown'],
  countdown: ['running'],
  running: ['paused', 'question', 'gameover'],
  paused: ['countdown'],
  question: ['feedback'],
  feedback: ['countdown', 'gameover'],
  gameover: ['idle'],
};

export function canTransition(from: GamePhase, to: GamePhase): boolean {
  return TRANSITIONS[from].includes(to);
}

/** Troca de fase respeitando a maquina de estados. Transicao invalida e ignorada. */
export function transition(state: GameState, to: GamePhase): GameState {
  if (!canTransition(state.phase, to)) return state;
  return { ...state, phase: to };
}

export function createInitialState(rng: Rng, now = 0): GameState {
  const snake = createSnake(CONFIG.GRID_COLS, CONFIG.GRID_ROWS);
  const fruit = spawnFruit(rng, snake) ?? { x: 0, y: 0 };
  return {
    phase: 'idle',
    snake,
    fruit,
    tickMs: CONFIG.INITIAL_TICK_MS,
    stats: { score: 0, correctCount: 0, wrongCount: 0, streak: 0, bestStreak: 0 },
    fruitsEaten: 0,
    attempts: [],
    gameOverReason: null,
    startedAt: now,
    endedAt: null,
  };
}

export function endGame(
  state: GameState,
  reason: GameOverReason,
  now: number,
): GameState {
  if (!canTransition(state.phase, 'gameover')) return state;
  return { ...state, phase: 'gameover', gameOverReason: reason, endedAt: now };
}

export function pause(state: GameState): GameState {
  if (state.phase !== 'running') return state;
  return { ...state, phase: 'paused', snake: clearQueue(state.snake) };
}

export function resume(state: GameState): GameState {
  return transition(state, 'countdown');
}

/**
 * Um tick do jogo: anda um passo e resolve parede, corpo e fruta.
 * Comer nao faz crescer — o crescimento e o premio da resposta certa.
 */
export function tick(state: GameState, now: number): GameState {
  if (state.phase !== 'running') return state;

  const moved = step(state.snake);
  const nextHead = head(moved);

  if (!CONFIG.WRAP_WALLS && hitsWall(nextHead, CONFIG.GRID_COLS, CONFIG.GRID_ROWS)) {
    return endGame({ ...state, snake: state.snake }, 'wall', now);
  }
  if (hitsSelf(moved)) {
    return endGame({ ...state, snake: moved }, 'self', now);
  }
  if (sameCell(nextHead, state.fruit)) {
    return {
      ...state,
      phase: 'question',
      snake: clearQueue(moved),
      fruitsEaten: state.fruitsEaten + 1,
    };
  }
  return { ...state, snake: moved };
}

/** Aplica pontuacao, comprimento e velocidade. Sempre leva de 'question' a 'feedback'. */
export function applyAnswer(state: GameState, log: AttemptLog): GameState {
  if (state.phase !== 'question') return state;
  const attempts = [...state.attempts, log];

  if (!log.correct) {
    return {
      ...state,
      phase: 'feedback',
      snake: shrink(state.snake),
      attempts,
      stats: {
        ...state.stats,
        wrongCount: state.stats.wrongCount + 1,
        streak: 0,
      },
    };
  }

  const streak = state.stats.streak + 1;
  const bonus =
    streak % CONFIG.STREAK_BONUS_EVERY === 0 ? CONFIG.STREAK_BONUS_POINTS : 0;

  return {
    ...state,
    phase: 'feedback',
    snake: grow(state.snake),
    tickMs: Math.max(CONFIG.MIN_TICK_MS, state.tickMs - CONFIG.TICK_DECREMENT_MS),
    attempts,
    stats: {
      score: state.stats.score + CONFIG.POINTS_PER_CORRECT + bonus,
      correctCount: state.stats.correctCount + 1,
      wrongCount: state.stats.wrongCount,
      streak,
      bestStreak: Math.max(state.stats.bestStreak, streak),
    },
  };
}

/** Fim do feedback: morre por encolhimento ou vai para a contagem regressiva. */
export function resolveFeedback(state: GameState, rng: Rng, now: number): GameState {
  if (state.phase !== 'feedback') return state;
  if (length(state.snake) < CONFIG.MIN_LENGTH) {
    return { ...state, phase: 'gameover', gameOverReason: 'too-short', endedAt: now };
  }
  const fruit = spawnFruit(rng, state.snake) ?? state.fruit;
  return { ...state, phase: 'countdown', fruit, snake: clearQueue(state.snake) };
}

export function startCountdown(state: GameState, now: number): GameState {
  const next = transition(state, 'countdown');
  if (next === state) return state;
  return state.phase === 'idle' ? { ...next, startedAt: now } : next;
}

export function restart(state: GameState, rng: Rng, now: number): GameState {
  if (state.phase !== 'gameover') return state;
  return createInitialState(rng, now);
}
