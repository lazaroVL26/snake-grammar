// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config';
import {
  cleanNick,
  clearScoreboard,
  dayKey,
  loadScoreboard,
  saveScore,
} from '../src/storage/scoreboard';
import type { ScoreEntry } from '../src/types';

const HOJE = new Date(2026, 8, 1, 14, 30);
const ONTEM = new Date(2026, 7, 31, 14, 30);

function entry(nick: string, score: number, playedAt = 1_000): Omit<ScoreEntry, 'date'> {
  return {
    nick,
    score,
    accuracy: 80,
    correct: 4,
    wrong: 1,
    topicLabel: 'Futuro',
    playedAt,
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('scoreboard — dia', () => {
  it('dayKey usa o dia local no formato AAAA-MM-DD', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05');
    expect(dayKey(new Date(2026, 11, 31, 0, 1))).toBe('2026-12-31');
  });

  it('o ranking comeca vazio', () => {
    expect(loadScoreboard(HOJE)).toEqual([]);
  });
});

describe('scoreboard — reset diario', () => {
  it('partidas de ontem somem quando o dia vira', () => {
    saveScore(entry('Ana', 90), ONTEM);
    saveScore(entry('Bruno', 40), ONTEM);
    expect(loadScoreboard(ONTEM).length).toBe(2);

    expect(loadScoreboard(HOJE)).toEqual([]);
  });

  it('o descarte e gravado: ontem nao volta depois de recarregar', () => {
    saveScore(entry('Ana', 90), ONTEM);
    loadScoreboard(HOJE);
    expect(window.localStorage.getItem(CONFIG.SCORE_STORAGE_KEY)).toBe('[]');
    expect(loadScoreboard(ONTEM)).toEqual([]);
  });

  it('partidas do mesmo dia convivem', () => {
    saveScore(entry('Ana', 90), new Date(2026, 8, 1, 8, 0));
    saveScore(entry('Bruno', 40), new Date(2026, 8, 1, 22, 0));
    expect(loadScoreboard(HOJE).map((e) => e.nick)).toEqual(['Ana', 'Bruno']);
  });

  it('a data gravada e a do dia da partida', () => {
    const saved = saveScore(entry('Ana', 10), HOJE);
    expect(saved.entry.date).toBe('2026-09-01');
  });
});

describe('scoreboard — ordem e limite', () => {
  it('ordena pela maior pontuacao', () => {
    saveScore(entry('Ana', 30), HOJE);
    saveScore(entry('Bruno', 90), HOJE);
    saveScore(entry('Caio', 60), HOJE);
    expect(loadScoreboard(HOJE).map((e) => e.nick)).toEqual(['Bruno', 'Caio', 'Ana']);
  });

  it('empate favorece quem chegou primeiro', () => {
    saveScore(entry('Ana', 50, 2_000), HOJE);
    saveScore(entry('Bruno', 50, 1_000), HOJE);
    expect(loadScoreboard(HOJE).map((e) => e.nick)).toEqual(['Bruno', 'Ana']);
  });

  it('devolve a colocacao da partida recem-salva', () => {
    saveScore(entry('Ana', 90), HOJE);
    saveScore(entry('Bruno', 30), HOJE);
    expect(saveScore(entry('Caio', 60), HOJE).position).toBe(2);
    expect(saveScore(entry('Duda', 200), HOJE).position).toBe(1);
  });

  it('guarda no maximo SCOREBOARD_SIZE partidas do dia', () => {
    for (let i = 0; i < CONFIG.SCOREBOARD_SIZE + 8; i += 1) {
      saveScore(entry(`Aluno ${i}`, i * 10), HOJE);
    }
    const board = loadScoreboard(HOJE);
    expect(board.length).toBe(CONFIG.SCOREBOARD_SIZE);
    expect(board[0]?.score).toBe((CONFIG.SCOREBOARD_SIZE + 7) * 10);
  });
});

describe('scoreboard — apelido', () => {
  it('apara espacos e limita o tamanho', () => {
    expect(cleanNick('  Ana   Beatriz ')).toBe('Ana Beatriz');
    expect(cleanNick('x'.repeat(50)).length).toBe(CONFIG.NICK_MAX_LENGTH);
  });

  it('remove caracteres invisiveis colados sem querer', () => {
    expect(cleanNick('An​onimo')).toBe('Anonimo');
    expect(cleanNick('Ana')).toBe('Ana');
  });

  it('apelido vazio vira "Sem nome" no ranking', () => {
    expect(saveScore({ ...entry('   ', 10) }, HOJE).entry.nick).toBe('Sem nome');
  });
});

describe('scoreboard — robustez', () => {
  it('ignora json invalido', () => {
    window.localStorage.setItem(CONFIG.SCORE_STORAGE_KEY, 'isso nao e json');
    expect(loadScoreboard(HOJE)).toEqual([]);
  });

  it('descarta entradas mal formadas e mantem as boas', () => {
    const boa = { ...entry('Ana', 50), date: dayKey(HOJE) };
    window.localStorage.setItem(
      CONFIG.SCORE_STORAGE_KEY,
      JSON.stringify([boa, { nick: 'Falha' }, null, 42, { ...boa, score: 'muito' }]),
    );
    expect(loadScoreboard(HOJE).map((e) => e.nick)).toEqual(['Ana']);
  });

  it('nao quebra com o localStorage bloqueado', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() => saveScore(entry('Ana', 10), HOJE)).not.toThrow();
    spy.mockRestore();
  });

  it('clearScoreboard zera o ranking do dia', () => {
    saveScore(entry('Ana', 10), HOJE);
    clearScoreboard();
    expect(loadScoreboard(HOJE)).toEqual([]);
  });
});
