import './styles/tokens.css';
import './styles/app.css';

import { CONFIG } from './config';
import { Engine } from './game/engine';
import { Renderer } from './game/renderer';
import { createRng } from './game/board';
import { queueDirection } from './game/snake';
import {
  applyAnswer,
  createInitialState,
  pause,
  resolveFeedback,
  restart,
  startCountdown,
  tick,
  transition,
} from './game/state';
import { bindKeyboard } from './input/keyboard';
import { bindSwipe, createDpad } from './input/touch';
import { el, query } from './ui/dom';
import type { AttemptLog, Direction, GameState } from './types';

const root = document.getElementById('app');
if (!root) throw new Error('Elemento #app nao encontrado no index.html.');

root.append(
  el('main', { class: 'shell' }, [
    el('h1', { class: 'shell__title', text: 'Snake Grammar' }),
    el('div', { id: 'hud', class: 'hud' }),
    el('div', { class: 'board' }, [
      el('canvas', {
        id: 'board',
        class: 'board__canvas',
        width: CONFIG.GRID_COLS * CONFIG.CELL_SIZE,
        height: CONFIG.GRID_ROWS * CONFIG.CELL_SIZE,
        'aria-label':
          'Tabuleiro do jogo Snake. Use as setas do teclado para mover a cobra.',
        role: 'img',
      }),
      el('div', { id: 'overlay', class: 'overlay' }),
    ]),
    el('div', { id: 'controls', class: 'controls' }),
    el('div', { id: 'modal-root' }),
  ]),
);

const canvas = query<HTMLCanvasElement>('#board');
const controls = query<HTMLElement>('#controls');
const renderer = new Renderer(canvas);
const rng = createRng(Date.now() >>> 0);

let state: GameState = createInitialState(rng, performance.now());

function setState(next: GameState): void {
  state = next;
}

function turn(direction: Direction): void {
  if (state.phase !== 'running' && state.phase !== 'countdown') return;
  setState({ ...state, snake: queueDirection(state.snake, direction) });
}

controls.append(createDpad(turn));
bindSwipe(canvas, turn);

// Placeholder da fase 3: a pergunta real entra na fase 5.
function autoAnswer(now: number): void {
  const log: AttemptLog = {
    questionId: 'placeholder',
    focus: 'simple-past',
    correct: true,
    chosen: 'ok',
    elapsedMs: 0,
  };
  setState(resolveFeedback(applyAnswer(state, log), rng, now));
  setState(transition(state, 'running'));
}

bindKeyboard({
  onDirection: turn,
  onTogglePause: () => {
    if (state.phase === 'running') setState(pause(state));
    else if (state.phase === 'paused') setState(transition(state, 'running'));
  },
  onConfirm: () => {
    if (state.phase === 'idle') setState(transition(startCountdown(state, performance.now()), 'running'));
    else if (state.phase === 'gameover') {
      setState(restart(state, rng, performance.now()));
      setState(transition(startCountdown(state, performance.now()), 'running'));
    }
  },
});

const engine = new Engine({
  tickMs: () => state.tickMs,
  onTick: (now) => {
    setState(tick(state, now));
    if (state.phase === 'question') autoAnswer(now);
  },
  onRender: (now) => renderer.draw(state, now),
  schedule: (callback) => window.requestAnimationFrame(callback),
  cancel: (handle) => window.cancelAnimationFrame(handle),
});

window.addEventListener('resize', () => renderer.resize());
engine.start();
