import type { Direction } from '../types';

const KEY_TO_DIRECTION: Record<string, Direction> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
  KeyW: 'up',
  KeyS: 'down',
  KeyA: 'left',
  KeyD: 'right',
};

export interface KeyboardHandlers {
  onDirection: (direction: Direction) => void;
  onTogglePause: () => void;
  onConfirm: () => void;
}

/** Teclado global do jogo. O modal cuida das proprias teclas e para a propagacao. */
export function bindKeyboard(handlers: KeyboardHandlers): () => void {
  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.defaultPrevented) return;
    const target = event.target;
    if (target instanceof HTMLElement && isTextField(target)) return;

    const direction = KEY_TO_DIRECTION[event.code];
    if (direction) {
      event.preventDefault();
      handlers.onDirection(direction);
      return;
    }

    // Botao em foco ativa a si mesmo com Espaco/Enter: nao duplicar a acao aqui.
    const onButton = target instanceof HTMLElement && target.closest('button') !== null;

    if (event.code === 'Escape' || (event.code === 'Space' && !onButton)) {
      event.preventDefault();
      handlers.onTogglePause();
      return;
    }
    if ((event.code === 'Enter' || event.code === 'NumpadEnter') && !onButton) {
      handlers.onConfirm();
    }
  };

  window.addEventListener('keydown', onKeyDown);
  return () => window.removeEventListener('keydown', onKeyDown);
}

function isTextField(node: HTMLElement): boolean {
  return node instanceof HTMLInputElement || node instanceof HTMLTextAreaElement;
}
