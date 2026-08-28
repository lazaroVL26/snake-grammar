export type Vec = { x: number; y: number };

export type Direction = 'up' | 'down' | 'left' | 'right';

export type Focus = 'simple-past' | 'past-perfect' | 'contrast';

export type AnswerMode = 'choice' | 'typed';

export type GamePhase =
  'idle' | 'countdown' | 'running' | 'paused' | 'question' | 'feedback' | 'gameover';

export type GameOverReason = 'wall' | 'self' | 'too-short';

export interface Question {
  id: string;
  level: 1 | 2 | 3;
  focus: Focus;
  /** Contem exatamente uma lacuna marcada com "___". */
  sentence: string;
  /** Verbo no infinitivo mostrado entre parenteses. */
  verbHint: string;
  /** Sempre 4 alternativas. */
  options: string[];
  /** Indice da alternativa correta em options. */
  answerIndex: number;
  /** Formas aceitas no modo digitado. */
  accepted: string[];
  /** Explicacao em portugues do Brasil. */
  explanation: string;
}

export interface AttemptLog {
  questionId: string;
  focus: Focus;
  correct: boolean;
  /** null = o tempo estourou sem resposta. */
  chosen: string | null;
  elapsedMs: number;
}

/** Gerador pseudoaleatorio injetavel: retorna um numero em [0, 1). */
export type Rng = () => number;

export interface Snake {
  /** segments[0] e a cabeca. */
  segments: readonly Vec[];
  /** Direcao aplicada no ultimo tick. */
  direction: Direction;
  /** Viradas aguardando aplicacao, no maximo CONFIG.DIRECTION_BUFFER. */
  pending: readonly Direction[];
}

export interface Stats {
  score: number;
  correctCount: number;
  wrongCount: number;
  streak: number;
  bestStreak: number;
}

export interface GameState {
  phase: GamePhase;
  snake: Snake;
  fruit: Vec;
  tickMs: number;
  stats: Stats;
  /** Quantas frutas ja foram comidas na partida. */
  fruitsEaten: number;
  attempts: AttemptLog[];
  gameOverReason: GameOverReason | null;
  /** Fase para a qual voltar quando a pausa terminar. */
  startedAt: number;
  endedAt: number | null;
}
