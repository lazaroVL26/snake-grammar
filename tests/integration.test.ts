import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { createRng } from '../src/game/board';
import {
  applyAnswer,
  createInitialState,
  resolveFeedback,
  startCountdown,
  tick,
  transition,
} from '../src/game/state';
import { length } from '../src/game/snake';
import { loadQuestions } from '../src/quiz/questions';
import { QuestionSelector } from '../src/quiz/selector';
import { buildReport } from '../src/ui/report';
import type { AttemptLog, GameState, Question } from '../src/types';

const bank = loadQuestions();
const byId = new Map(bank.map((question) => [question.id, question]));

/** Anda ate encostar na fruta, teleportando a fruta para a frente da cabeca. */
function eatFruit(state: GameState): GameState {
  const head = state.snake.segments[0];
  if (!head) throw new Error('cobra sem cabeca');
  const withFruit: GameState = { ...state, fruit: { x: head.x + 1, y: head.y } };
  return tick(withFruit, 0);
}

function answer(state: GameState, question: Question, correct: boolean): GameState {
  const log: AttemptLog = {
    questionId: question.id,
    focus: question.focus,
    correct,
    chosen: correct ? (question.options[question.answerIndex] ?? '') : null,
    elapsedMs: 1200,
  };
  return applyAnswer(state, log);
}

describe('partida completa', () => {
  it('comeca, come, acerta, cresce, erra, encolhe e morre por encolhimento', () => {
    const rng = createRng(2024);
    const selector = new QuestionSelector(bank, rng);
    let state = createInitialState(rng, 0);
    expect(state.phase).toBe('idle');

    state = startCountdown(state, 0);
    expect(state.phase).toBe('countdown');
    state = transition(state, 'running');
    expect(state.phase).toBe('running');

    // 1) come e acerta: cresce e pontua.
    state = eatFruit(state);
    expect(state.phase).toBe('question');
    const q1 = selector.next();
    state = answer(state, q1, true);
    expect(state.phase).toBe('feedback');
    expect(length(state.snake)).toBe(4);
    expect(state.stats.score).toBe(CONFIG.POINTS_PER_CORRECT);
    state = resolveFeedback(state, rng, 100);
    expect(state.phase).toBe('countdown');
    state = transition(state, 'running');

    // 2) erra uma vez: a penalidade de 2 leva de 4 para 2 segmentos e mata.
    state = eatFruit(state);
    expect(state.phase).toBe('question');
    const q2 = selector.next();
    selector.requeue(q2);
    state = answer(state, q2, false);
    expect(length(state.snake)).toBe(4 - CONFIG.WRONG_PENALTY_SEGMENTS);
    state = resolveFeedback(state, rng, 200);

    expect(length(state.snake)).toBe(2);
    expect(state.phase).toBe('gameover');
    expect(state.gameOverReason).toBe('too-short');
    expect(state.stats.score).toBe(CONFIG.POINTS_PER_CORRECT);
    expect(state.stats.correctCount).toBe(1);
    expect(state.stats.wrongCount).toBe(1);
  });

  it('o relatorio final traz as frases erradas com a explicacao', () => {
    const rng = createRng(7);
    const selector = new QuestionSelector(bank, rng);
    // Cobra longa: com a penalidade de 2 segmentos ela precisa sobreviver a
    // dois erros para o relatorio ter duas frases para revisar.
    let state: GameState = {
      ...createInitialState(rng, 0),
      phase: 'running',
      snake: {
        segments: Array.from({ length: 8 }, (_, i) => ({ x: 10 - i, y: 10 })),
        direction: 'right',
        pending: [],
      },
    };

    const wrong: Question[] = [];
    for (let i = 0; i < 3; i += 1) {
      state = eatFruit(state);
      const question = selector.next();
      const isCorrect = i === 0;
      if (!isCorrect) wrong.push(question);
      state = answer(state, question, isCorrect);
      state = resolveFeedback(state, rng, 500);
      if (state.phase === 'countdown') state = transition(state, 'running');
    }
    state = { ...state, phase: 'gameover', endedAt: 61_000 };

    const report = buildReport(state, 999, byId, 61_000);
    expect(report.correct).toBe(1);
    expect(report.wrong).toBe(2);
    expect(report.accuracy).toBe(33);
    expect(report.bestScore).toBe(999);
    expect(report.missed.length).toBe(2);
    expect(report.byFocus.reduce((sum, row) => sum + row.correct + row.wrong, 0)).toBe(3);

    for (const [index, item] of report.missed.entries()) {
      const question = wrong[index] as Question;
      expect(item.explanation).toBe(question.explanation);
      expect(item.answer).toBe(question.options[question.answerIndex]);
      expect(item.sentence).not.toContain('___');
      expect(item.chosen).toBeNull();
    }
  });

  it('morre na parede indo sempre para a direita', () => {
    const rng = createRng(1);
    let state: GameState = {
      ...createInitialState(rng, 0),
      phase: 'running',
      fruit: { x: 0, y: 0 },
    };
    for (let i = 0; i < 40 && state.phase === 'running'; i += 1) {
      state = tick(state, i);
    }
    expect(state.phase).toBe('gameover');
    expect(state.gameOverReason).toBe('wall');
  });
});
