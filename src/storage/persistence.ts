import { CONFIG } from '../config';
import type { GameState } from '../types';
import { cleanNick } from './scoreboard';

export interface PersistedStats {
  /** Apelido do aluno, lembrado entre partidas. */
  nick: string;
  bestScore: number;
  bestStreak: number;
  gamesPlayed: number;
  totalCorrect: number;
  totalWrong: number;
}

const EMPTY: PersistedStats = {
  nick: '',
  bestScore: 0,
  bestStreak: 0,
  gamesPlayed: 0,
  totalCorrect: 0,
  totalWrong: 0,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

/** Le o recorde. Dados corrompidos ou localStorage bloqueado voltam ao zero. */
export function loadStats(): PersistedStats {
  try {
    const raw = window.localStorage.getItem(CONFIG.STORAGE_KEY);
    if (!raw) return { ...EMPTY };
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return { ...EMPTY };
    const data = parsed as Record<string, unknown>;
    return {
      nick: typeof data.nick === 'string' ? cleanNick(data.nick) : '',
      bestScore: isFiniteNumber(data.bestScore) ? data.bestScore : 0,
      bestStreak: isFiniteNumber(data.bestStreak) ? data.bestStreak : 0,
      gamesPlayed: isFiniteNumber(data.gamesPlayed) ? data.gamesPlayed : 0,
      totalCorrect: isFiniteNumber(data.totalCorrect) ? data.totalCorrect : 0,
      totalWrong: isFiniteNumber(data.totalWrong) ? data.totalWrong : 0,
    };
  } catch {
    return { ...EMPTY };
  }
}

export function saveStats(stats: PersistedStats): void {
  try {
    window.localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // Modo privativo ou armazenamento cheio: o jogo continua sem recorde salvo.
  }
}

/** Fecha a partida no armazenamento e devolve os numeros ja atualizados. */
export function recordGame(state: GameState): PersistedStats {
  const previous = loadStats();
  const updated: PersistedStats = {
    nick: previous.nick,
    bestScore: Math.max(previous.bestScore, state.stats.score),
    bestStreak: Math.max(previous.bestStreak, state.stats.bestStreak),
    gamesPlayed: previous.gamesPlayed + 1,
    totalCorrect: previous.totalCorrect + state.stats.correctCount,
    totalWrong: previous.totalWrong + state.stats.wrongCount,
  };
  saveStats(updated);
  return updated;
}

/** Lembra o apelido para o aluno nao redigitar a cada partida. */
export function saveNick(nick: string): void {
  saveStats({ ...loadStats(), nick: cleanNick(nick) });
}
