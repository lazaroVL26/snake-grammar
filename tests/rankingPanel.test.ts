// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';
import { RankingPanel, positionLabel } from '../src/ui/scoreboard';
import type { ScoreEntry } from '../src/types';

function entry(nick: string, score: number, accuracy: number): ScoreEntry {
  return {
    nick,
    score,
    accuracy,
    correct: 4,
    wrong: 1,
    topicLabel: 'Futuro',
    playedAt: 1_000,
    date: '2026-09-01',
  };
}

const board = [entry('Bruno', 90, 90), entry('Ana', 40, 50)];

let root: HTMLElement;
let panel: RankingPanel;

beforeEach(() => {
  document.body.replaceChildren();
  root = document.createElement('aside');
  document.body.append(root);
  panel = new RankingPanel(root);
});

describe('RankingPanel — coluna ao lado do tabuleiro', () => {
  it('mostra titulo, data e a lista do dia', () => {
    panel.update(board, '2026-09-01');
    expect(root.querySelector('.rank-side__title')?.textContent).toBe('Ranking de hoje');
    expect(root.querySelector('.rank-side__date')?.textContent).toBe('2026-09-01');
    const rows = Array.from(root.querySelectorAll('.ranking__row'));
    expect(rows.length).toBe(2);
    expect(rows[0]?.textContent).toContain('Bruno');
    expect(rows[0]?.textContent).toContain('90');
    expect(rows[1]?.textContent).toContain('Ana');
  });

  it('avisa que a lista e da turma e zera todo dia', () => {
    panel.update(board, '2026-09-01');
    expect(root.textContent).toContain('Toda a turma. Zera todo dia.');
  });

  it('avisa quando o servidor caiu e a lista e so deste PC', () => {
    panel.update(board, '2026-09-01', { shared: false });
    expect(root.textContent).toContain('Sem conexao com o servidor');
    expect(root.querySelector('.rank-side__note--offline')).not.toBeNull();
  });

  it('avisa quando ninguem jogou ainda', () => {
    panel.update([], '2026-09-01');
    expect(root.textContent).toContain('Ninguem jogou hoje ainda');
    expect(root.querySelector('.ranking')).toBeNull();
  });

  it('destaca a partida recem-jogada', () => {
    const mine = board[1] as ScoreEntry;
    panel.update(board, '2026-09-01', { highlight: mine });
    const highlighted = root.querySelector('.ranking__row--mine');
    expect(highlighted?.textContent).toContain('Ana');
    expect(highlighted?.getAttribute('aria-current')).toBe('true');
    expect(root.querySelectorAll('.ranking__row--mine').length).toBe(1);
  });

  it('mostra no maximo o top 10, mesmo com a turma inteira na lista', () => {
    const turma = Array.from({ length: 25 }, (_, i) =>
      entry(`Aluno ${i}`, (25 - i) * 10, 70),
    );
    panel.update(turma, '2026-09-01');
    expect(root.querySelectorAll('.ranking__row').length).toBe(CONFIG.SCOREBOARD_VISIBLE);
    expect(root.textContent).toContain('Aluno 0');
    expect(root.textContent).not.toContain('Aluno 20');
  });

  it('redesenhar substitui a lista em vez de acumular', () => {
    panel.update(board, '2026-09-01');
    panel.update([entry('Duda', 10, 20)], '2026-09-02');
    expect(root.querySelectorAll('.ranking__row').length).toBe(1);
    expect(root.querySelector('.rank-side__date')?.textContent).toBe('2026-09-02');
    expect(root.textContent).not.toContain('Bruno');
  });
});

describe('positionLabel', () => {
  it('a primeira partida do dia tem texto proprio', () => {
    expect(positionLabel(1, 1)).toBe('Primeira partida do dia.');
  });

  it('as demais mostram colocacao e total', () => {
    expect(positionLabel(2, 5)).toBe('2o lugar de 5 partidas hoje.');
  });
});
