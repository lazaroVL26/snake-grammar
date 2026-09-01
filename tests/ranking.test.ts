// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchRanking, submitScore } from '../src/storage/ranking';
import { CONFIG } from '../src/config';
import type { ScoreEntry } from '../src/types';

const HOJE = '2026-09-01';

function entry(nick: string, score: number): ScoreEntry {
  return {
    nick,
    score,
    accuracy: 80,
    correct: 4,
    wrong: 1,
    topicLabel: 'Futuro',
    playedAt: 1_000,
    date: HOJE,
  };
}

function partida(nick: string, score: number) {
  return { nick, score, accuracy: 80, correct: 4, wrong: 1, topicLabel: 'Futuro' };
}

/** Responde como o servidor responderia. */
function serverOk(payload: unknown, status = 200) {
  return vi.fn().mockResolvedValue({
    ok: status >= 200 && status < 300,
    status,
    json: () => Promise.resolve(payload),
  });
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('ranking — servidor no ar', () => {
  it('le a lista da turma e marca como compartilhada', async () => {
    vi.stubGlobal(
      'fetch',
      serverOk({ today: HOJE, board: [entry('Bruno', 90), entry('Ana', 40)] }),
    );
    const snapshot = await fetchRanking('2026-09-01');
    expect(snapshot.shared).toBe(true);
    expect(snapshot.board.map((e) => e.nick)).toEqual(['Bruno', 'Ana']);
  });

  it('descarta entradas mal formadas vindas do servidor', async () => {
    vi.stubGlobal(
      'fetch',
      serverOk({ today: HOJE, board: [entry('Ana', 40), { nick: 'Lixo' }, null] }),
    );
    const snapshot = await fetchRanking(HOJE);
    expect(snapshot.board.map((e) => e.nick)).toEqual(['Ana']);
  });

  it('envia a partida e devolve a colocacao do servidor', async () => {
    const enviado = entry('Ana', 40);
    const fetchMock = serverOk(
      { today: HOJE, board: [entry('Bruno', 90), enviado], entry: enviado, position: 2 },
      201,
    );
    vi.stubGlobal('fetch', fetchMock);

    const saved = await submitScore(partida('Ana', 40), HOJE);
    expect(saved.position).toBe(2);
    expect(saved.snapshot.shared).toBe(true);
    expect(saved.snapshot.board.length).toBe(2);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual(partida('Ana', 40));
  });

  it('grava no PC tambem, para nao perder a partida se o servidor cair depois', async () => {
    const enviado = entry('Ana', 40);
    vi.stubGlobal(
      'fetch',
      serverOk({ today: HOJE, board: [enviado], entry: enviado, position: 1 }, 201),
    );
    await submitScore(partida('Ana', 40), HOJE);
    expect(window.localStorage.getItem(CONFIG.SCORE_STORAGE_KEY)).toContain(
      '"nick":"Ana"',
    );
  });
});

describe('ranking — servidor fora do ar', () => {
  it('cai para o ranking deste PC ao ler', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede caiu')));
    const snapshot = await fetchRanking(HOJE);
    expect(snapshot.shared).toBe(false);
    expect(snapshot.board).toEqual([]);
    expect(snapshot.today).toBe(HOJE);
  });

  it('cai para o ranking deste PC ao enviar, sem perder a partida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede caiu')));
    const saved = await submitScore(partida('Ana', 40), HOJE);
    expect(saved.snapshot.shared).toBe(false);
    expect(saved.entry.nick).toBe('Ana');
    expect(saved.position).toBe(1);
    expect(window.localStorage.getItem(CONFIG.SCORE_STORAGE_KEY)).toContain(
      '"nick":"Ana"',
    );
  });

  it('trata resposta de erro do servidor como queda', async () => {
    vi.stubGlobal('fetch', serverOk({ error: 'quebrou' }, 500));
    expect((await fetchRanking(HOJE)).shared).toBe(false);
  });

  it('trata resposta sem formato esperado como queda', async () => {
    vi.stubGlobal('fetch', serverOk({ qualquer: 'coisa' }));
    expect((await fetchRanking(HOJE)).shared).toBe(false);
  });

  it('depois de uma queda, o PC ainda lista as proprias partidas', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('rede caiu')));
    await submitScore(partida('Ana', 40), HOJE);
    await submitScore(partida('Bruno', 90), HOJE);
    const snapshot = await fetchRanking(HOJE);
    expect(snapshot.board.map((e) => e.nick)).toEqual(['Bruno', 'Ana']);
    expect(snapshot.shared).toBe(false);
  });
});

describe('ranking — servidor lento', () => {
  it('a chamada leva um sinal de timeout, para nao travar a tela', async () => {
    const fetchMock = serverOk({ today: HOJE, board: [] });
    vi.stubGlobal('fetch', fetchMock);
    await fetchRanking(HOJE);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.signal).toBeInstanceOf(AbortSignal);
  });

  it('timeout cai para o ranking deste PC', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValue(new DOMException('The operation timed out.', 'TimeoutError')),
    );
    expect((await fetchRanking(HOJE)).shared).toBe(false);
  });
});
