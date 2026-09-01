import { el } from './dom';

/**
 * Tela cheia. Maximiza a pagina inteira, nao so o tabuleiro: o modal da
 * pergunta vive fora do canvas e sumiria se o alvo fosse apenas o jogo.
 */
export function fullscreenSupported(): boolean {
  return (
    typeof document !== 'undefined' &&
    document.fullscreenEnabled === true &&
    typeof document.documentElement.requestFullscreen === 'function'
  );
}

export function isFullscreen(): boolean {
  return document.fullscreenElement !== null;
}

/** Alterna e devolve o estado final. Falha em silencio se o navegador recusar. */
export async function toggleFullscreen(): Promise<boolean> {
  try {
    if (isFullscreen()) {
      await document.exitFullscreen();
      return false;
    }
    await document.documentElement.requestFullscreen();
    return true;
  } catch {
    // Navegador recusou (permissao, iframe sem allow): segue na tela normal.
    return isFullscreen();
  }
}

const ENTER_LABEL = 'Tela cheia';
const EXIT_LABEL = 'Sair da tela cheia';

/**
 * Botao que acompanha o estado real: sair pelo Esc ou por F11 tambem atualiza
 * o rotulo, porque escutamos o evento do navegador em vez de guardar estado.
 */
export function createFullscreenButton(): HTMLButtonElement {
  const button = el('button', {
    type: 'button',
    class: 'fullscreen-toggle btn btn-outline-secondary btn-sm',
    'aria-pressed': 'false',
    title: 'Tela cheia (tecla F)',
    text: ENTER_LABEL,
  });

  if (!fullscreenSupported()) {
    button.hidden = true;
    return button;
  }

  const sync = (): void => {
    const active = isFullscreen();
    button.textContent = active ? EXIT_LABEL : ENTER_LABEL;
    button.setAttribute('aria-pressed', String(active));
  };

  button.addEventListener('click', () => void toggleFullscreen());
  document.addEventListener('fullscreenchange', sync);
  sync();

  return button;
}
