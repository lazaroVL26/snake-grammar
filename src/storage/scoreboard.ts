import { CONFIG } from '../config';
import type { ScoreEntry } from '../types';

/** Dia local no formato AAAA-MM-DD. E a chave que zera o ranking. */
export function dayKey(now: Date = new Date()): string {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/** Apara o apelido: sem espaco duplo, sem controle, no maximo NICK_MAX_LENGTH. */
export function cleanNick(value: string): string {
  return value
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, CONFIG.NICK_MAX_LENGTH);
}

function isEntry(value: unknown): value is ScoreEntry {
  if (typeof value !== 'object' || value === null) return false;
  const entry = value as Record<string, unknown>;
  const number = (field: unknown): boolean =>
    typeof field === 'number' && Number.isFinite(field) && field >= 0;
  return (
    typeof entry.nick === 'string' &&
    typeof entry.date === 'string' &&
    typeof entry.topicLabel === 'string' &&
    number(entry.score) &&
    number(entry.accuracy) &&
    number(entry.correct) &&
    number(entry.wrong) &&
    number(entry.playedAt)
  );
}

/** Maior pontuacao primeiro; empate desempata por quem chegou antes. */
function rank(entries: ScoreEntry[]): ScoreEntry[] {
  return [...entries].sort((a, b) => b.score - a.score || a.playedAt - b.playedAt);
}

function readRaw(): ScoreEntry[] {
  try {
    const raw = window.localStorage.getItem(CONFIG.SCORE_STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(isEntry);
  } catch {
    return [];
  }
}

function write(entries: ScoreEntry[]): void {
  try {
    window.localStorage.setItem(CONFIG.SCORE_STORAGE_KEY, JSON.stringify(entries));
  } catch {
    // Modo privativo ou armazenamento cheio: a partida continua sem ranking.
  }
}

/**
 * Ranking de hoje, ja ordenado. Partidas de outros dias sao descartadas aqui —
 * e assim que o "zera todo dia" acontece, sem precisar de tarefa agendada.
 */
export function loadScoreboard(now: Date = new Date()): ScoreEntry[] {
  const today = dayKey(now);
  const all = readRaw();
  const mine = rank(all.filter((entry) => entry.date === today)).slice(
    0,
    CONFIG.SCOREBOARD_SIZE,
  );
  if (mine.length !== all.length) write(mine);
  return mine;
}

export interface SavedScore {
  board: ScoreEntry[];
  entry: ScoreEntry;
  /** Colocacao da partida no ranking de hoje, comecando em 1. */
  position: number;
}

/** Guarda a partida no ranking do dia e devolve a colocacao dela. */
export function saveScore(
  entry: Omit<ScoreEntry, 'date'>,
  now: Date = new Date(),
): SavedScore {
  const stored: ScoreEntry = {
    ...entry,
    nick: cleanNick(entry.nick) || 'Sem nome',
    date: dayKey(now),
  };
  const board = rank([...loadScoreboard(now), stored]).slice(0, CONFIG.SCOREBOARD_SIZE);
  write(board);
  const position = board.indexOf(stored) + 1;
  return { board, entry: stored, position };
}

export function clearScoreboard(): void {
  try {
    window.localStorage.removeItem(CONFIG.SCORE_STORAGE_KEY);
  } catch {
    // Nada a fazer: sem armazenamento, nao ha ranking para limpar.
  }
}
