import './styles/tokens.css';
import './styles/app.css';

import { CONFIG } from './config';
import { createRng } from './game/board';
import { Engine } from './game/engine';
import { Renderer } from './game/renderer';
import { queueDirection } from './game/snake';
import {
  applyAnswer,
  createInitialState,
  pause,
  resolveFeedback,
  startCountdown,
  tick,
  transition,
} from './game/state';
import { bindKeyboard } from './input/keyboard';
import { bindSwipe, createDpad } from './input/touch';
import { QuestionBankError, loadQuestions, questionsForTopic } from './quiz/questions';
import { QuestionSelector, presentQuestion } from './quiz/selector';
import { DEFAULT_TOPIC, findTopic } from './quiz/topics';
import { loadStats, recordGame, saveNick } from './storage/persistence';
import {
  dayKey,
  loadScoreboard,
  saveScore,
  scoreboardToText,
} from './storage/scoreboard';
import { buildShell, showBankError } from './ui/shell';
import { Hud } from './ui/hud';
import { Overlays } from './ui/overlays';
import { QuestionModal, type AnswerResult } from './ui/questionModal';
import { buildReport, reportToText } from './ui/report';
import type { RankingView } from './ui/overlays';
import type {
  AnswerMode,
  AttemptLog,
  Direction,
  GameState,
  Question,
  TopicId,
} from './types';

const root = document.getElementById('app');
if (!root) throw new Error('Elemento #app nao encontrado no index.html.');

let bank: Question[];
try {
  bank = loadQuestions();
} catch (error) {
  const problems = error instanceof QuestionBankError ? error.problems : [String(error)];
  console.error(error);
  showBankError(root, problems);
  throw error;
}

const shell = buildShell(root);
const rng = createRng(Date.now() >>> 0);
const renderer = new Renderer(shell.canvas);
const hud = new Hud(shell.hud);

let topic: TopicId = DEFAULT_TOPIC;
let pool: Question[] = questionsForTopic(findTopic(topic), bank);
let state: GameState = createInitialState(rng, performance.now());
let selector = new QuestionSelector(pool, rng);
let best = loadStats().bestScore;
let mode: AnswerMode = 'choice';
let currentQuestion: Question | null = null;
let countdownEndsAt = 0;
let nick = loadStats().nick;
let ranking: RankingView | null = null;

const byId = new Map(bank.map((question) => [question.id, question]));

/** Tela inicial: recorde pessoal, apelido lembrado e o ranking de hoje. */
function showIdleScreen(): void {
  overlays.showIdle({
    bestScore: best,
    nick,
    today: dayKey(),
    board: loadScoreboard(),
    questionCount: countFor,
  });
}

/** Quantas frases cada conteudo do menu tem, para o aluno escolher com informacao. */
function countFor(id: TopicId): number {
  return questionsForTopic(findTopic(id), bank).length;
}

const overlays = new Overlays(shell.overlay, {
  onStart: (chosen, chosenTopic, chosenNick) => {
    mode = chosen;
    topic = chosenTopic;
    nick = chosenNick;
    saveNick(chosenNick);
    pool = questionsForTopic(findTopic(topic), bank);
    selector = new QuestionSelector(pool, rng);
    beginGame();
  },
  onResume: () => enterCountdown(),
  onRestart: () => resetGame(),
  onCopyReport: () => copyReport(),
  onCopyRanking: () => copyRanking(),
});

const modal = new QuestionModal(shell.modalRoot, {
  onAnswered: (result) => onAnswered(result),
  onDismissed: () => onFeedbackDone(),
});

function turn(direction: Direction): void {
  if (state.phase !== 'running' && state.phase !== 'countdown') return;
  state = { ...state, snake: queueDirection(state.snake, direction) };
}

function enterCountdown(): void {
  const next =
    state.phase === 'idle'
      ? startCountdown(state, performance.now())
      : transition(state, 'countdown');
  if (next.phase !== 'countdown') return;
  state = next;
  countdownEndsAt = performance.now() + CONFIG.RESUME_COUNTDOWN_MS * 3;
  engine.resetClock();
}

function beginGame(): void {
  overlays.hide();
  enterCountdown();
}

function resetGame(): void {
  state = createInitialState(rng, performance.now());
  selector = new QuestionSelector(pool, rng);
  currentQuestion = null;
  best = loadStats().bestScore;
  hud.update(state, best);
  showIdleScreen();
}

function askQuestion(): void {
  const question = selector.next();
  currentQuestion = question;
  modal.open(presentQuestion(question, rng), mode);
}

function onAnswered(result: AnswerResult): void {
  const question = currentQuestion;
  if (!question) return;
  const log: AttemptLog = {
    questionId: question.id,
    focus: question.focus,
    correct: result.correct,
    chosen: result.chosen,
    elapsedMs: result.elapsedMs,
  };
  if (!result.correct) selector.requeue(question);
  state = applyAnswer(state, log);
  hud.update(state, best);
}

function onFeedbackDone(): void {
  state = resolveFeedback(state, rng, performance.now());
  currentQuestion = null;
  hud.update(state, best);
  if (state.phase === 'gameover') finishGame();
  else {
    countdownEndsAt = performance.now() + CONFIG.RESUME_COUNTDOWN_MS * 3;
    engine.resetClock();
  }
}

function finishGame(): void {
  const stats = recordGame(state);
  best = stats.bestScore;
  hud.update(state, best);

  const report = buildReport(
    state,
    best,
    byId,
    performance.now(),
    findTopic(topic).label,
    nick,
  );
  const saved = saveScore({
    nick,
    score: report.score,
    accuracy: report.accuracy,
    correct: report.correct,
    wrong: report.wrong,
    topicLabel: report.topicLabel,
    playedAt: Date.now(),
  });
  ranking = { ...saved, today: dayKey() };
  overlays.showGameOver(report, ranking);
}

async function copyReport(): Promise<boolean> {
  const text = reportToText(
    buildReport(state, best, byId, performance.now(), findTopic(topic).label, nick),
  );
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

async function copyRanking(): Promise<boolean> {
  const text = scoreboardToText(ranking?.board ?? loadScoreboard(), dayKey());
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

function togglePause(): void {
  if (state.phase === 'running') {
    state = pause(state);
    overlays.showPaused();
  } else if (state.phase === 'paused') {
    overlays.hide();
    enterCountdown();
  }
}

function pauseIfRunning(): void {
  if (state.phase !== 'running') return;
  state = pause(state);
  overlays.showPaused();
}

const engine = new Engine({
  tickMs: () => state.tickMs,
  onTick: (now) => {
    if (state.phase !== 'running') return;
    state = tick(state, now);
    if (state.phase === 'question') askQuestion();
    else if (state.phase === 'gameover') finishGame();
    hud.update(state, best);
  },
  onRender: (now) => {
    if (state.phase === 'countdown') updateCountdown(now);
    renderer.draw(state, now);
  },
  schedule: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
});

function updateCountdown(now: number): void {
  const remaining = countdownEndsAt - now;
  if (remaining <= 0) {
    state = transition(state, 'running');
    overlays.hide();
    engine.resetClock();
    return;
  }
  overlays.showCountdown(Math.ceil(remaining / CONFIG.RESUME_COUNTDOWN_MS));
}

bindKeyboard({
  onDirection: turn,
  onTogglePause: togglePause,
  onConfirm: () => {
    if (state.phase === 'idle') overlays.requestStart();
    else if (state.phase === 'gameover') {
      resetGame();
      beginGame();
    }
  },
});

shell.controls.append(createDpad(turn));
bindSwipe(shell.canvas, turn);

window.addEventListener('blur', pauseIfRunning);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) pauseIfRunning();
});
window.addEventListener('resize', () => renderer.resize());

hud.update(state, best);
showIdleScreen();
engine.start();
