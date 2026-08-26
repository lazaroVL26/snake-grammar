import { CONFIG } from '../config';
import { el } from './dom';

export interface Shell {
  canvas: HTMLCanvasElement;
  hud: HTMLElement;
  overlay: HTMLElement;
  controls: HTMLElement;
  modalRoot: HTMLElement;
}

/** Monta o esqueleto do DOM e devolve os pontos de montagem. */
export function buildShell(root: HTMLElement): Shell {
  const hud = el('div', { class: 'hud' });
  const overlay = el('div', { class: 'overlay', hidden: true });
  const controls = el('div', { class: 'controls' });
  const modalRoot = el('div', { class: 'modal-root' });

  const canvas = el('canvas', {
    class: 'board__canvas',
    width: CONFIG.GRID_COLS * CONFIG.CELL_SIZE,
    height: CONFIG.GRID_ROWS * CONFIG.CELL_SIZE,
    role: 'img',
    'aria-label':
      'Tabuleiro 20 por 20. A cobra amarela come a fruta vermelha e abre uma pergunta de ingles.',
  });

  root.replaceChildren(
    el('main', { class: 'shell' }, [
      el('header', { class: 'shell__head' }, [
        el('h1', { class: 'shell__title', text: 'Snake Grammar' }),
        el('p', {
          class: 'shell__sub',
          text: 'Simple Past x Past Perfect',
        }),
      ]),
      hud,
      el('div', { class: 'board' }, [canvas, overlay]),
      el('p', {
        class: 'hints',
        text: 'Setas ou WASD movem • Espaco ou Esc pausam • 1 a 4 marcam a alternativa • Enter confirma',
      }),
      controls,
      modalRoot,
    ]),
  );

  return { canvas, hud, overlay, controls, modalRoot };
}

/** Tela de erro legivel quando o banco de questoes esta inconsistente. */
export function showBankError(root: HTMLElement, problems: string[]): void {
  root.replaceChildren(
    el('main', { class: 'shell shell--error' }, [
      el('h1', { class: 'shell__title', text: 'O banco de questoes esta invalido' }),
      el('p', {
        class: 'panel__lead',
        text: 'Corrija content/questions.seed.json e recarregue a pagina. Problemas encontrados:',
      }),
      el(
        'ul',
        { class: 'errors' },
        problems.map((problem) => el('li', { text: problem })),
      ),
    ]),
  );
}
