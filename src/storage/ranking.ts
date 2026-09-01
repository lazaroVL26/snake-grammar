import type { ScoreEntry } from '../types';
import { loadScoreboard, saveScore } from './scoreboard';

/** Partida pronta para enviar. O servidor e quem carimba data e horario. */
export type NewScore = Omit<ScoreEntry, 'date' | 'playedAt'>;

export interface RankingSnapshot {
  board: ScoreEntry[];
  today: string;
  /** false = servidor fora do ar; a lista e so deste PC. */
  shared: boolean;
}

export interface SubmittedScore {
  snapshot: RankingSnapshot;
  entry: ScoreEntry;
  position: number;
}

const ENDPOINT = '/api/scores';
/** Servidor lento nao pode travar a tela do aluno. */
const TIMEOUT_MS = 3_000;

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

function readSnapshot(payload: unknown): RankingSnapshot | null {
  if (typeof payload !== 'object' || payload === null) return null;
  const data = payload as Record<string, unknown>;
  if (typeof data.today !== 'string' || !Array.isArray(data.board)) return null;
  return { board: data.board.filter(isEntry), today: data.today, shared: true };
}

async function request(path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(path, {
    ...init,
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`servidor respondeu ${response.status}`);
  return (await response.json()) as unknown;
}

function localSnapshot(today: string): RankingSnapshot {
  return { board: loadScoreboard(), today, shared: false };
}

/** Ranking da turma. Se o servidor nao responder, cai para o deste PC. */
export async function fetchRanking(localToday: string): Promise<RankingSnapshot> {
  try {
    const snapshot = readSnapshot(await request(ENDPOINT));
    return snapshot ?? localSnapshot(localToday);
  } catch {
    return localSnapshot(localToday);
  }
}

/**
 * Envia a partida. Grava sempre no PC também: se o servidor cair no meio da
 * aula, o aluno não perde o que jogou.
 */
export async function submitScore(
  score: NewScore,
  localToday: string,
): Promise<SubmittedScore> {
  const local = saveScore({ ...score, playedAt: Date.now() });

  try {
    const payload = (await request(ENDPOINT, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(score),
    })) as Record<string, unknown>;

    const snapshot = readSnapshot(payload);
    const entry = payload?.entry;
    if (snapshot && isEntry(entry) && typeof payload.position === 'number') {
      return { snapshot, entry, position: payload.position };
    }
  } catch {
    // Sem servidor: o ranking do PC ja tem a partida.
  }

  return {
    snapshot: { board: local.board, today: localToday, shared: false },
    entry: local.entry,
    position: local.position,
  };
}
