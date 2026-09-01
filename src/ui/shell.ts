import { CONFIG } from '../config';
import { el } from './dom';
import { createFullscreenButton } from './fullscreen';

export interface Shell {
  /** Cabecalho, onde ficam os botoes de tela cheia e som. */
  head: HTMLElement;
  canvas: HTMLCanvasElement;
  hud: HTMLElement;
  overlay: HTMLElement;
  controls: HTMLElement;
  modalRoot: HTMLElement;
  /** Coluna do ranking, ao lado do tabuleiro. */
  ranking: HTMLElement;
}

/** Monta o esqueleto do DOM e devolve os pontos de montagem. */
export function buildShell(root: HTMLElement): Shell {
  const hud = el('div', { class: 'hud' });
  const overlay = el('div', { class: 'overlay', hidden: true });
  // Sem .d-flex do Bootstrap: ele traz !important e venceria o display:none
  // que esconde o D-pad em telas com mouse.
  const controls = el('div', { class: 'controls' });
  const modalRoot = el('div', { class: 'modal-root' });
  const head = el('header', {
    class: 'shell__head d-flex align-items-baseline flex-wrap gap-3',
  });
  const ranking = el('aside', {
    class: 'rank-side card p-3',
    'aria-label': 'Ranking de hoje',
  });

  const canvas = el('canvas', {
    class: 'board__canvas',
    width: CONFIG.GRID_COLS * CONFIG.CELL_SIZE,
    height: CONFIG.GRID_ROWS * CONFIG.CELL_SIZE,
    role: 'img',
    'aria-label':
      'Tabuleiro 20 por 20. A cobra amarela come a fruta vermelha e abre uma pergunta de ingles.',
  });

  head.append(
    el('h1', { class: 'shell__title mb-0', text: 'Snake Grammar' }),
    el('p', { class: 'shell__sub mb-0', text: 'Passado, presente e futuro' }),
    createFullscreenButton(),
  );

  root.replaceChildren(
    el('main', { class: 'shell container-lg px-0' }, [
      // A coluna do jogo e um elemento proprio: sem isso o ranking teria que
      // atravessar linhas do grid, e `grid-row: 1 / -1` nao vale sem linhas
      // explicitas — o ranking acabava esticando o cabecalho.
      el('div', { class: 'shell__main' }, [
        head,
        hud,
        el('div', { class: 'board' }, [canvas, overlay]),
        el('p', {
          class: 'hints text-center mb-0',
          text: 'Setas ou WASD movem • Espaco ou Esc pausam • F abre tela cheia • 1 a 4 marcam a alternativa • Enter confirma',
        }),
        controls,
      ]),
      ranking,
      modalRoot,
    ]),
  );

  return { canvas, head, hud, overlay, controls, modalRoot, ranking };
}

/** Tela de erro legivel quando o banco de questoes esta inconsistente. */
export function showBankError(root: HTMLElement, problems: string[]): void {
  root.replaceChildren(
    el('main', { class: 'shell shell--error container-lg px-0' }, [
      el('h1', { class: 'shell__title', text: 'O banco de questoes esta invalido' }),
      el('p', {
        class: 'panel__lead alert alert-danger',
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
