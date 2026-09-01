import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

/** @typedef {{nick:string,score:number,accuracy:number,correct:number,wrong:number,topicLabel:string,playedAt:number,date:string}} ScoreEntry */

/** Quantas partidas do dia ficam no arquivo. */
export const MAX_ENTRIES = 500;
export const MAX_NICK = 16;
const MAX_TOPIC = 40;
const MAX_SCORE = 1_000_000;

/** Dia local no formato AAAA-MM-DD. O relogio do servidor e a autoridade. */
export function dayKey(now = new Date()) {
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function cleanNick(value) {
  if (typeof value !== 'string') return '';
  return value
    .replace(/[\p{Cc}\p{Cf}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_NICK);
}

function wholeNumber(value, max) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) return null;
  return Math.min(Math.floor(value), max);
}

/**
 * Valida o que chegou pela rede. Qualquer aluno pode mandar qualquer coisa para
 * a porta aberta, entao nada aqui confia no cliente.
 * @returns {ScoreEntry|null}
 */
export function sanitizeEntry(raw, now = new Date()) {
  if (typeof raw !== 'object' || raw === null) return null;
  const nick = cleanNick(raw.nick) || 'Sem nome';
  const score = wholeNumber(raw.score, MAX_SCORE);
  const accuracy = wholeNumber(raw.accuracy, 100);
  const correct = wholeNumber(raw.correct, MAX_SCORE);
  const wrong = wholeNumber(raw.wrong, MAX_SCORE);
  if (score === null || accuracy === null || correct === null || wrong === null) {
    return null;
  }
  const topicLabel =
    typeof raw.topicLabel === 'string' && raw.topicLabel.trim() !== ''
      ? raw.topicLabel.trim().slice(0, MAX_TOPIC)
      : 'Todos os tempos';

  // playedAt e date vem do servidor: relogio errado de aluno nao bagunca o dia.
  return {
    nick,
    score,
    accuracy,
    correct,
    wrong,
    topicLabel,
    playedAt: now.getTime(),
    date: dayKey(now),
  };
}

function isEntry(value) {
  if (typeof value !== 'object' || value === null) return false;
  const ok = (n) => typeof n === 'number' && Number.isFinite(n) && n >= 0;
  return (
    typeof value.nick === 'string' &&
    typeof value.date === 'string' &&
    typeof value.topicLabel === 'string' &&
    ok(value.score) &&
    ok(value.accuracy) &&
    ok(value.correct) &&
    ok(value.wrong) &&
    ok(value.playedAt)
  );
}

/** Maior pontuacao primeiro; empate desempata por quem chegou antes. */
function rank(entries) {
  return [...entries].sort((a, b) => b.score - a.score || a.playedAt - b.playedAt);
}

/**
 * Cada aluno aparece uma vez, com a melhor partida do dia. Sem isso, quem joga
 * dez vezes ocupa a lista inteira e esconde a turma.
 */
export function bestPerNick(entries) {
  const best = new Map();
  for (const entry of rank(entries)) {
    const key = entry.nick.toLowerCase();
    if (!best.has(key)) best.set(key, entry);
  }
  return [...best.values()];
}

/**
 * Ranking do dia num arquivo JSON. Todas as escritas passam por uma fila, e o
 * arquivo e trocado por rename: dois alunos terminando junto nao se perdem nem
 * deixam o arquivo pela metade.
 */
export class ScoreStore {
  /** @param {string} file */
  constructor(file) {
    this.file = file;
    /** @type {ScoreEntry[]} */
    this.entries = [];
    this.loaded = false;
    /** @type {Promise<unknown>} */
    this.queue = Promise.resolve();
  }

  /** Enfileira uma operacao: nunca ha dois read-modify-write ao mesmo tempo. */
  run(task) {
    const next = this.queue.then(task, task);
    // A fila nao pode morrer por causa de uma falha isolada.
    this.queue = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  async load() {
    if (this.loaded) return;
    try {
      const raw = await readFile(this.file, 'utf8');
      const parsed = JSON.parse(raw);
      this.entries = Array.isArray(parsed) ? parsed.filter(isEntry) : [];
    } catch {
      this.entries = [];
    }
    this.loaded = true;
  }

  async persist() {
    const temp = `${this.file}.tmp`;
    await mkdir(dirname(this.file), { recursive: true });
    await writeFile(temp, JSON.stringify(this.entries, null, 2), 'utf8');
    await rename(temp, this.file);
  }

  /** Ranking de hoje. O que e de outro dia e descartado e o arquivo e podado. */
  read(now = new Date()) {
    return this.run(async () => {
      await this.load();
      const today = dayKey(now);
      const mine = this.entries.filter((entry) => entry.date === today);
      if (mine.length !== this.entries.length) {
        this.entries = mine;
        await this.persist();
      }
      return { today, board: bestPerNick(mine) };
    });
  }

  /** Guarda uma partida e devolve o ranking ja atualizado, com a colocacao. */
  add(raw, now = new Date()) {
    return this.run(async () => {
      await this.load();
      const entry = sanitizeEntry(raw, now);
      if (!entry) return null;

      const today = entry.date;
      const kept = this.entries.filter((item) => item.date === today);
      kept.push(entry);
      this.entries = rank(kept).slice(0, MAX_ENTRIES);
      await this.persist();

      const board = bestPerNick(this.entries);
      const position =
        board.findIndex(
          (item) => item.playedAt === entry.playedAt && item.nick === entry.nick,
        ) + 1;
      return { today, board, entry, position: position || board.length };
    });
  }
}
