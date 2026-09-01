import type { ScoreEntry } from '../types';
import { el } from './dom';

/**
 * Lista do ranking do dia. `highlight` marca a partida recem-jogada, para o
 * aluno se achar na lista sem precisar procurar.
 */
/**
 * Compara por conteudo, nao por referencia: a lista vem do localStorage ja
 * reserializada, entao os objetos nunca sao os mesmos da partida que acabou.
 */
function isSameEntry(a: ScoreEntry, b: ScoreEntry): boolean {
  return a.playedAt === b.playedAt && a.nick === b.nick && a.score === b.score;
}

export function scoreboardList(
  board: readonly ScoreEntry[],
  highlight?: ScoreEntry,
): HTMLElement {
  if (board.length === 0) {
    return el('p', {
      class: 'panel__note',
      text: 'Ninguem jogou hoje ainda. Voce pode ser o primeiro.',
    });
  }

  return el(
    'ol',
    { class: 'ranking' },
    board.map((entry) => {
      const isMine = highlight !== undefined && isSameEntry(entry, highlight);
      const row = el('li', { class: 'ranking__row' }, [
        el('span', { class: 'ranking__nick', text: entry.nick }),
        el('span', { class: 'ranking__score', text: String(entry.score) }),
        el('span', { class: 'ranking__accuracy', text: `${entry.accuracy}%` }),
      ]);
      if (isMine) {
        row.classList.add('ranking__row--mine');
        row.setAttribute('aria-current', 'true');
      }
      return row;
    }),
  );
}

/** "1o lugar de hoje" — a frase que aparece no fim da partida. */
export function positionLabel(position: number, total: number): string {
  if (total <= 1) return 'Primeira partida do dia.';
  return `${position}o lugar de ${total} partidas hoje.`;
}

/**
 * Coluna do ranking ao lado do tabuleiro. Fica visivel a partida inteira e e
 * redesenhada quando alguem termina de jogar.
 */
export class RankingPanel {
  constructor(private readonly root: HTMLElement) {}

  update(board: readonly ScoreEntry[], today: string, highlight?: ScoreEntry): void {
    this.root.replaceChildren(
      el('h2', { class: 'rank-side__title', text: 'Ranking de hoje' }),
      el('p', { class: 'rank-side__date', text: today }),
      scoreboardList(board, highlight),
      el('p', {
        class: 'rank-side__note',
        text: 'A lista zera todo dia.',
      }),
    );
  }
}
