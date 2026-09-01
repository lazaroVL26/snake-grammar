// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createFullscreenButton,
  fullscreenSupported,
  isFullscreen,
  toggleFullscreen,
} from '../src/ui/fullscreen';

/** O jsdom nao implementa a Fullscreen API: aqui vai uma de mentira. */
function installApi(options: { enabled?: boolean; failing?: boolean } = {}): {
  entradas: number;
  saidas: number;
} {
  const contagem = { entradas: 0, saidas: 0 };
  let elemento: Element | null = null;

  Object.defineProperty(document, 'fullscreenEnabled', {
    value: options.enabled !== false,
    configurable: true,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    get: () => elemento,
    configurable: true,
  });

  document.documentElement.requestFullscreen = vi.fn(() => {
    if (options.failing) return Promise.reject(new Error('permissao negada'));
    contagem.entradas += 1;
    elemento = document.documentElement;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });

  document.exitFullscreen = vi.fn(() => {
    contagem.saidas += 1;
    elemento = null;
    document.dispatchEvent(new Event('fullscreenchange'));
    return Promise.resolve();
  });

  return contagem;
}

function removeApi(): void {
  Object.defineProperty(document, 'fullscreenEnabled', {
    value: false,
    configurable: true,
  });
  Object.defineProperty(document, 'fullscreenElement', {
    value: null,
    configurable: true,
  });
  // @ts-expect-error removendo de proposito para simular navegador sem suporte
  document.documentElement.requestFullscreen = undefined;
}

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('fullscreen — deteccao de suporte', () => {
  it('reconhece navegador com suporte', () => {
    installApi();
    expect(fullscreenSupported()).toBe(true);
  });

  it('reconhece navegador sem suporte', () => {
    removeApi();
    expect(fullscreenSupported()).toBe(false);
  });

  it('reconhece quando o navegador tem a API mas bloqueia o recurso', () => {
    installApi({ enabled: false });
    expect(fullscreenSupported()).toBe(false);
  });
});

describe('fullscreen — alternar', () => {
  it('entra e sai da tela cheia', async () => {
    const contagem = installApi();
    expect(isFullscreen()).toBe(false);

    expect(await toggleFullscreen()).toBe(true);
    expect(isFullscreen()).toBe(true);
    expect(contagem.entradas).toBe(1);

    expect(await toggleFullscreen()).toBe(false);
    expect(isFullscreen()).toBe(false);
    expect(contagem.saidas).toBe(1);
  });

  it('maximiza a pagina inteira, nao so o tabuleiro', async () => {
    installApi();
    await toggleFullscreen();
    // O modal da pergunta vive fora do canvas: so a pagina inteira o mantem visivel.
    expect(document.fullscreenElement).toBe(document.documentElement);
  });

  it('nao quebra quando o navegador recusa', async () => {
    installApi({ failing: true });
    await expect(toggleFullscreen()).resolves.toBe(false);
    expect(isFullscreen()).toBe(false);
  });
});

describe('fullscreen — botao', () => {
  it('comeca oferecendo tela cheia', () => {
    installApi();
    const button = createFullscreenButton();
    expect(button.hidden).toBe(false);
    expect(button.textContent).toBe('Tela cheia');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(button.title).toContain('tecla F');
  });

  it('some quando o navegador nao suporta', () => {
    removeApi();
    expect(createFullscreenButton().hidden).toBe(true);
  });

  it('clicar alterna e o rotulo acompanha', async () => {
    const contagem = installApi();
    const button = createFullscreenButton();
    document.body.append(button);

    button.click();
    await vi.waitFor(() => expect(contagem.entradas).toBe(1));
    expect(button.textContent).toBe('Sair da tela cheia');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    await vi.waitFor(() => expect(contagem.saidas).toBe(1));
    expect(button.textContent).toBe('Tela cheia');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });

  it('sair pelo Esc ou F11 tambem atualiza o rotulo', async () => {
    installApi();
    const button = createFullscreenButton();
    document.body.append(button);

    button.click();
    await vi.waitFor(() => expect(button.textContent).toBe('Sair da tela cheia'));

    // O navegador saiu sozinho: o estado vem do evento, nao de uma variavel nossa.
    await document.exitFullscreen();
    expect(button.textContent).toBe('Tela cheia');
    expect(button.getAttribute('aria-pressed')).toBe('false');
  });
});
