import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { networkInterfaces } from 'node:os';
import { ScoreStore } from './scores.mjs';

const here = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = resolve(here, '..');
const publicDir = resolve(projectRoot, 'dist');
const scoresFile = resolve(projectRoot, 'data', 'scores.json');

/** Corpo maior que isso e recusado: a porta fica aberta para a rede da escola. */
const MAX_BODY_BYTES = 4 * 1024;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
};

export function createApp(store) {
  return async function handle(request, response) {
    const url = new URL(request.url ?? '/', 'http://localhost');

    // Mesma origem no uso normal; liberado para o servidor de desenvolvimento.
    response.setHeader('Access-Control-Allow-Origin', '*');
    response.setHeader('Access-Control-Allow-Headers', 'content-type');
    response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    if (request.method === 'OPTIONS') return end(response, 204, '');

    if (url.pathname === '/api/health') {
      return json(response, 200, { ok: true });
    }

    if (url.pathname === '/api/scores') {
      if (request.method === 'GET') {
        return json(response, 200, await store.read());
      }
      if (request.method === 'POST') {
        let body;
        try {
          body = await readBody(request);
        } catch (error) {
          return json(response, 413, { error: String(error.message ?? error) });
        }
        let parsed;
        try {
          parsed = JSON.parse(body || '{}');
        } catch {
          return json(response, 400, { error: 'JSON invalido.' });
        }
        const saved = await store.add(parsed);
        if (!saved) return json(response, 400, { error: 'Partida invalida.' });
        return json(response, 201, saved);
      }
      return json(response, 405, { error: 'Metodo nao suportado.' });
    }

    if (url.pathname.startsWith('/api/')) {
      return json(response, 404, { error: 'Rota desconhecida.' });
    }

    return serveStatic(url.pathname, response);
  };
}

function readBody(request) {
  return new Promise((resolveBody, rejectBody) => {
    let size = 0;
    let data = '';
    request.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        rejectBody(new Error('Corpo grande demais.'));
        request.destroy();
        return;
      }
      data += chunk;
    });
    request.on('end', () => resolveBody(data));
    request.on('error', rejectBody);
  });
}

async function serveStatic(pathname, response) {
  const relative = normalize(decodeURIComponent(pathname)).replace(/^([/\\])+/, '');
  const target = resolve(publicDir, relative || 'index.html');

  // Nada de sair de dist/ com ../ na URL.
  if (target !== publicDir && !target.startsWith(publicDir + sep)) {
    return end(response, 403, 'Acesso negado.');
  }

  let file = target;
  try {
    const info = await stat(file);
    if (info.isDirectory()) file = join(file, 'index.html');
  } catch {
    file = join(publicDir, 'index.html');
  }

  try {
    const content = await readFile(file);
    response.setHeader('Content-Type', MIME[extname(file)] ?? 'application/octet-stream');
    // O HTML nao pode ficar em cache: o aluno tem que pegar a versao nova.
    response.setHeader(
      'Cache-Control',
      extname(file) === '.html' ? 'no-cache' : 'public, max-age=3600',
    );
    response.writeHead(200);
    response.end(content);
  } catch {
    end(
      response,
      404,
      'Arquivo nao encontrado. Rode "npm run build" antes de servir o jogo.',
    );
  }
}

function json(response, status, payload) {
  const body = JSON.stringify(payload);
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  response.setHeader('Cache-Control', 'no-store');
  response.writeHead(status);
  response.end(body);
}

function end(response, status, text) {
  response.setHeader('Content-Type', 'text/plain; charset=utf-8');
  response.writeHead(status);
  response.end(text);
}

/** Enderecos IPv4 da maquina, para o professor saber o que ditar para a turma. */
export function localAddresses() {
  const found = [];
  for (const list of Object.values(networkInterfaces())) {
    for (const item of list ?? []) {
      if (item.family === 'IPv4' && !item.internal) found.push(item.address);
    }
  }
  return found;
}

export function startServer({ port = 8080, host = '0.0.0.0', file = scoresFile } = {}) {
  const store = new ScoreStore(file);
  const server = createServer((request, response) => {
    createApp(store)(request, response).catch(() => {
      if (!response.headersSent) json(response, 500, { error: 'Erro interno.' });
      else response.end();
    });
  });
  return new Promise((resolveServer) => {
    server.listen(port, host, () => resolveServer({ server, store }));
  });
}

const isMain =
  process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (isMain) {
  const port = Number(process.env.PORT ?? 8080);
  startServer({ port }).then(() => {
    const addresses = localAddresses();
    process.stdout.write(`\nSnake Grammar servindo na porta ${port}\n`);
    process.stdout.write(`  neste PC:      http://localhost:${port}\n`);
    for (const address of addresses) {
      process.stdout.write(`  para a turma:  http://${address}:${port}\n`);
    }
    process.stdout.write(`  ranking em:    ${scoresFile}\n\n`);
  });
}
