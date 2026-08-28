import type { Direction } from '../types';
import { el } from '../ui/dom';

const SWIPE_THRESHOLD_PX = 24;

/** Swipe sobre o tabuleiro. Ignora gestos curtos para nao virar sem querer. */
export function bindSwipe(
  surface: HTMLElement,
  onDirection: (direction: Direction) => void,
): () => void {
  let startX = 0;
  let startY = 0;
  let tracking = false;

  const onStart = (event: TouchEvent): void => {
    const touch = event.touches[0];
    if (!touch) return;
    startX = touch.clientX;
    startY = touch.clientY;
    tracking = true;
  };

  const onEnd = (event: TouchEvent): void => {
    if (!tracking) return;
    tracking = false;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const dx = touch.clientX - startX;
    const dy = touch.clientY - startY;
    if (Math.abs(dx) < SWIPE_THRESHOLD_PX && Math.abs(dy) < SWIPE_THRESHOLD_PX) return;
    if (Math.abs(dx) > Math.abs(dy)) onDirection(dx > 0 ? 'right' : 'left');
    else onDirection(dy > 0 ? 'down' : 'up');
  };

  surface.addEventListener('touchstart', onStart, { passive: true });
  surface.addEventListener('touchend', onEnd, { passive: true });
  return () => {
    surface.removeEventListener('touchstart', onStart);
    surface.removeEventListener('touchend', onEnd);
  };
}

const PAD: Array<{ direction: Direction; label: string; area: string }> = [
  { direction: 'up', label: 'Cima', area: 'up' },
  { direction: 'left', label: 'Esquerda', area: 'left' },
  { direction: 'right', label: 'Direita', area: 'right' },
  { direction: 'down', label: 'Baixo', area: 'down' },
];

const GLYPH: Record<Direction, string> = {
  up: '↑',
  down: '↓',
  left: '←',
  right: '→',
};

/** D-pad na tela, visivel apenas em telas pequenas (regra em app.css). */
export function createDpad(onDirection: (direction: Direction) => void): HTMLElement {
  const pad = el('div', {
    class: 'dpad',
    role: 'group',
    'aria-label': 'Controles de direcao',
  });
  for (const button of PAD) {
    const node = el(
      'button',
      {
        type: 'button',
        class: `dpad__key dpad__key--${button.area}`,
        'aria-label': button.label,
      },
      [GLYPH[button.direction]],
    );
    node.addEventListener('click', () => onDirection(button.direction));
    pad.append(node);
  }
  return pad;
}
