// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CONFIG } from '../src/config';
import { createRng } from '../src/game/board';
import { createInitialState } from '../src/game/state';
import { loadStats, recordGame, saveStats } from '../src/storage/persistence';
import type { GameState } from '../src/types';

function finished(score: number, correct: number, wrong: number): GameState {
  const base = createInitialState(createRng(1), 0);
  return {
    ...base,
    phase: 'gameover',
    stats: {
      score,
      correctCount: correct,
      wrongCount: wrong,
      streak: 0,
      bestStreak: correct,
    },
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

describe('persistence', () => {
  it('comeca zerado quando nao ha nada salvo', () => {
    expect(loadStats()).toEqual({
      bestScore: 0,
      bestStreak: 0,
      gamesPlayed: 0,
      totalCorrect: 0,
      totalWrong: 0,
    });
  });

  it('grava na chave unica do projeto', () => {
    saveStats({
      bestScore: 30,
      bestStreak: 2,
      gamesPlayed: 1,
      totalCorrect: 3,
      totalWrong: 1,
    });
    expect(window.localStorage.getItem(CONFIG.STORAGE_KEY)).toContain('"bestScore":30');
  });

  it('o recorde sobrevive a um recarregamento', () => {
    recordGame(finished(80, 6, 2));
    // Uma nova leitura equivale a abrir a pagina de novo.
    expect(loadStats().bestScore).toBe(80);
  });

  it('mantem o recorde antigo quando a partida nova pontua menos', () => {
    recordGame(finished(80, 6, 2));
    const stats = recordGame(finished(20, 2, 5));
    expect(stats.bestScore).toBe(80);
    expect(stats.gamesPlayed).toBe(2);
    expect(stats.totalCorrect).toBe(8);
    expect(stats.totalWrong).toBe(7);
  });

  it('ignora dados corrompidos em vez de quebrar o jogo', () => {
    window.localStorage.setItem(CONFIG.STORAGE_KEY, '{isso nao e json');
    expect(loadStats().bestScore).toBe(0);
    window.localStorage.setItem(CONFIG.STORAGE_KEY, '{"bestScore":"muito"}');
    expect(loadStats().bestScore).toBe(0);
  });

  it('nao quebra quando o localStorage esta bloqueado', () => {
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('bloqueado');
    });
    expect(() =>
      saveStats({
        bestScore: 1,
        bestStreak: 1,
        gamesPlayed: 1,
        totalCorrect: 1,
        totalWrong: 0,
      }),
    ).not.toThrow();
    spy.mockRestore();
  });
});
