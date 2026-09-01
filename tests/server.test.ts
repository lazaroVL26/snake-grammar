import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { request as httpRequest } from 'node:http';
import {
  ScoreStore,
  bestPerNick,
  cleanNick,
  dayKey,
  sanitizeEntry,
} from '../server/scores.mjs';
import { startServer } from '../server/index.mjs';

interface Entry {
  nick: string;
  score: number;
  accuracy: number;
  correct: number;
  wrong: number;
  topicLabel: string;
  playedAt: number;
  date: string;
}

interface Board {
  today: string;
  board: Entry[];
  entry?: Entry;
  position?: number;
}

let dir: string;
let file: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'snake-scores-'));
  file = join(dir, 'scores.json');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function partida(nick: string, score: number) {
  return { nick, score, accuracy: 80, correct: 4, wrong: 1, topicLabel: 'Futuro' };
}

describe('servidor — validacao do que chega pela rede', () => {
  it('recusa corpo que nao e objeto', () => {
    expect(sanitizeEntry(null)).toBeNull();
    expect(sanitizeEntry('texto')).toBeNull();
    expect(sanitizeEntry(42)).toBeNull();
  });

  it('recusa numeros invalidos, negativos ou de texto', () => {
    expect(sanitizeEntry({ ...partida('Ana', 10), score: -5 })).toBeNull();
    expect(sanitizeEntry({ ...partida('Ana', 10), score: 'muito' })).toBeNull();
    expect(sanitizeEntry({ ...partida('Ana', 10), accuracy: Number.NaN })).toBeNull();
    expect(sanitizeEntry({ ...partida('Ana', 10), correct: Infinity })).toBeNull();
  });

  it('limita precisao a 100 e arredonda para inteiro', () => {
    const entry = sanitizeEntry({ ...partida('Ana', 10.7), accuracy: 999 }) as Entry;
    expect(entry.accuracy).toBe(100);
    expect(entry.score).toBe(10);
  });

  it('apara apelido e corta o que passa do limite', () => {
    expect(cleanNick('  Ana   Beatriz ')).toBe('Ana Beatriz');
    expect(cleanNick('x'.repeat(50)).length).toBe(16);
    expect((sanitizeEntry(partida('   ', 10)) as Entry).nick).toBe('Sem nome');
  });

  it('corta rotulo de conteudo gigante e aceita ausencia', () => {
    const grande = sanitizeEntry({
      ...partida('Ana', 10),
      topicLabel: 'y'.repeat(90),
    }) as Entry;
    expect(grande.topicLabel.length).toBe(40);
    const semRotulo = sanitizeEntry({ ...partida('Ana', 10), topicLabel: '' }) as Entry;
    expect(semRotulo.topicLabel).toBe('Todos os tempos');
  });

  it('ignora playedAt e date mandados pelo cliente: quem manda e o servidor', () => {
    const agora = new Date(2026, 8, 1, 10, 0);
    const entry = sanitizeEntry(
      { ...partida('Ana', 10), playedAt: 1, date: '1999-01-01' },
      agora,
    ) as Entry;
    expect(entry.date).toBe('2026-09-01');
    expect(entry.playedAt).toBe(agora.getTime());
  });
});

describe('servidor — ranking por aluno', () => {
  it('cada apelido aparece uma vez, com a melhor partida', () => {
    const base = { accuracy: 80, correct: 4, wrong: 1, topicLabel: 'Futuro', date: 'x' };
    const board = bestPerNick([
      { ...base, nick: 'Ana', score: 30, playedAt: 1 },
      { ...base, nick: 'Ana', score: 90, playedAt: 2 },
      { ...base, nick: 'Bruno', score: 50, playedAt: 3 },
    ]) as Entry[];
    expect(board.map((e) => `${e.nick}:${e.score}`)).toEqual(['Ana:90', 'Bruno:50']);
  });

  it('apelido igual com caixa diferente conta como a mesma pessoa', () => {
    const base = { accuracy: 80, correct: 4, wrong: 1, topicLabel: 'Futuro', date: 'x' };
    const board = bestPerNick([
      { ...base, nick: 'ana', score: 30, playedAt: 1 },
      { ...base, nick: 'ANA', score: 90, playedAt: 2 },
    ]) as Entry[];
    expect(board.length).toBe(1);
    expect(board[0]?.score).toBe(90);
  });
});

describe('servidor — arquivo e reset diario', () => {
  it('grava no arquivo e le de volta depois de reiniciar', async () => {
    const store = new ScoreStore(file);
    await store.add(partida('Ana', 90));
    const salvo = JSON.parse(await readFile(file, 'utf8')) as Entry[];
    expect(salvo[0]?.nick).toBe('Ana');

    const outro = new ScoreStore(file);
    const { board } = (await outro.read()) as Board;
    expect(board.map((e) => e.nick)).toEqual(['Ana']);
  });

  it('descarta partidas de outro dia e poda o arquivo', async () => {
    const ontem = new Date(Date.now() - 24 * 60 * 60 * 1000);
    await writeFile(
      file,
      JSON.stringify([
        {
          nick: 'Ontem',
          score: 999,
          accuracy: 100,
          correct: 9,
          wrong: 0,
          topicLabel: 'Futuro',
          playedAt: ontem.getTime(),
          date: dayKey(ontem),
        },
      ]),
      'utf8',
    );

    const store = new ScoreStore(file);
    const { board } = (await store.read()) as Board;
    expect(board).toEqual([]);
    expect(JSON.parse(await readFile(file, 'utf8'))).toEqual([]);
  });

  it('sobrevive a arquivo corrompido', async () => {
    await writeFile(file, 'isso nao e json', 'utf8');
    const store = new ScoreStore(file);
    const { board } = (await store.read()) as Board;
    expect(board).toEqual([]);
    await store.add(partida('Ana', 10));
    expect(((await store.read()) as Board).board.length).toBe(1);
  });
});

describe('servidor — varias pessoas ao mesmo tempo', () => {
  it('40 partidas simultaneas: nenhuma se perde', async () => {
    const store = new ScoreStore(file);
    const alunos = Array.from({ length: 40 }, (_, i) => partida(`Aluno ${i}`, i * 10));

    await Promise.all(alunos.map((aluno) => store.add(aluno)));

    const { board } = (await store.read()) as Board;
    expect(board.length).toBe(40);
    expect(board[0]?.score).toBe(390);

    // O arquivo em disco tem que bater com o que o servidor responde.
    const salvo = JSON.parse(await readFile(file, 'utf8')) as Entry[];
    expect(salvo.length).toBe(40);
  });

  it('o mesmo aluno mandando varias partidas junto mantem so a melhor', async () => {
    const store = new ScoreStore(file);
    await Promise.all([10, 90, 50, 70].map((score) => store.add(partida('Ana', score))));
    const { board } = (await store.read()) as Board;
    expect(board.length).toBe(1);
    expect(board[0]?.score).toBe(90);
  });

  it('devolve a colocacao certa para cada aluno', async () => {
    const store = new ScoreStore(file);
    await store.add(partida('Ana', 90));
    await store.add(partida('Bruno', 30));
    const meio = (await store.add(partida('Caio', 60))) as Board;
    expect(meio.position).toBe(2);
    const topo = (await store.add(partida('Duda', 200))) as Board;
    expect(topo.position).toBe(1);
  });
});

describe('servidor — HTTP', () => {
  let close: () => void;
  let base: string;

  beforeEach(async () => {
    const { server } = (await startServer({ port: 0, host: '127.0.0.1', file })) as {
      server: { address: () => { port: number }; close: () => void };
    };
    base = `http://127.0.0.1:${server.address().port}`;
    close = () => server.close();
  });

  afterEach(() => close());

  it('responde a checagem de saude', async () => {
    const response = await fetch(`${base}/api/health`);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('GET devolve o ranking do dia', async () => {
    const response = await fetch(`${base}/api/scores`);
    expect(response.status).toBe(200);
    const data = (await response.json()) as Board;
    expect(data.today).toBe(dayKey());
    expect(data.board).toEqual([]);
  });

  it('POST guarda a partida e devolve a colocacao', async () => {
    const response = await fetch(`${base}/api/scores`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(partida('Ana', 90)),
    });
    expect(response.status).toBe(201);
    const data = (await response.json()) as Board;
    expect(data.position).toBe(1);
    expect(data.board[0]?.nick).toBe('Ana');
  });

  it('30 PCs postando ao mesmo tempo: todos entram e todos veem a mesma lista', async () => {
    const envios = Array.from({ length: 30 }, (_, i) =>
      fetch(`${base}/api/scores`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(partida(`Aluno ${i}`, i * 10)),
      }),
    );
    const respostas = await Promise.all(envios);
    expect(respostas.every((r) => r.status === 201)).toBe(true);

    const leituras = await Promise.all(
      Array.from({ length: 10 }, () =>
        fetch(`${base}/api/scores`).then((r) => r.json() as Promise<Board>),
      ),
    );
    for (const leitura of leituras) {
      expect(leitura.board.length).toBe(30);
      expect(leitura.board[0]?.score).toBe(290);
    }
  });

  it('recusa JSON invalido, partida invalida e metodo errado', async () => {
    const semJson = await fetch(`${base}/api/scores`, { method: 'POST', body: 'nada' });
    expect(semJson.status).toBe(400);

    const invalida = await fetch(`${base}/api/scores`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ nick: 'Ana', score: -1 }),
    });
    expect(invalida.status).toBe(400);

    const metodo = await fetch(`${base}/api/scores`, { method: 'DELETE' });
    expect(metodo.status).toBe(405);
  });

  it('recusa corpo grande demais', async () => {
    const response = await fetch(`${base}/api/scores`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ ...partida('Ana', 10), lixo: 'x'.repeat(20_000) }),
    }).catch(() => null);
    expect(response === null || response.status === 413).toBe(true);
  });

  it('rota de api desconhecida devolve 404', async () => {
    expect((await fetch(`${base}/api/nao-existe`)).status).toBe(404);
  });

  it('nao deixa sair da pasta publica com ../ no caminho cru', async () => {
    // fetch normaliza "../" antes de enviar, entao o pedido vai por socket.
    const bruto = (path: string): Promise<string> =>
      new Promise((done, fail) => {
        const request = httpRequest(
          { host: '127.0.0.1', port: Number(new URL(base).port), path, method: 'GET' },
          (response) => {
            let body = '';
            response.on('data', (chunk) => (body += chunk));
            response.on('end', () => done(body));
          },
        );
        request.on('error', fail);
        request.end();
      });

    for (const path of [
      '/../package.json',
      '/../../etc/passwd',
      '/%2e%2e%2f%2e%2e%2fpackage.json',
      '/..%2fpackage.json',
    ]) {
      const body = await bruto(path);
      expect(body, path).not.toContain('"name": "snake-grammar"');
      expect(body, path).not.toContain('root:x:');
    }
  });
});
