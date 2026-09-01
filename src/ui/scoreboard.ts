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
      class: 'panel__note text-secondary mb-0',
      text: 'Ninguem jogou hoje ainda. Voce pode ser o primeiro.',
    });
  }

  return el(
    'ol',
    { class: 'ranking list-group list-group-flush' },
    board.map((entry) => {
      const isMine = highlight !== undefined && isSameEntry(entry, highlight);
      const row = el('li', { class: 'ranking__row list-group-item' }, [
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

  update(
    board: readonly ScoreEntry[],
    today: string,
    options: { highlight?: ScoreEntry | undefined; shared?: boolean } = {},
  ): void {
    const shared = options.shared !== false;
    this.root.replaceChildren(
      el('h2', { class: 'rank-side__title mb-0', text: 'Ranking de hoje' }),
      el('p', { class: 'rank-side__date mb-0', text: today }),
      scoreboardList(board, options.highlight),
      shared
        ? el('p', {
            class: 'rank-side__note mb-0',
            text: 'Toda a turma. Zera todo dia.',
          })
        : el('p', {
            class:
              'rank-side__note rank-side__note--offline alert alert-warning py-2 mb-0',
            role: 'status',
            text: 'Sem conexao com o servidor. Mostrando so as partidas deste PC.',
          }),
    );
  }
}
