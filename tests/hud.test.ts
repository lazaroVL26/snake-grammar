// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from 'vitest';
import { createRng } from '../src/game/board';
import { createInitialState } from '../src/game/state';
import { Hud } from '../src/ui/hud';
import type { GameState } from '../src/types';

let root: HTMLElement;
let hud: Hud;

function estado(overrides: Partial<GameState['stats']> = {}): GameState {
  const base = createInitialState(createRng(1), 0);
  return { ...base, stats: { ...base.stats, ...overrides } };
}

function valores(): string[] {
  return Array.from(root.querySelectorAll('.hud__value')).map(
    (node) => node.textContent ?? '',
  );
}

function pulsando(): string[] {
  return Array.from(root.querySelectorAll('.hud__value--bump')).map(
    (node) => node.textContent ?? '',
  );
}

beforeEach(() => {
  document.body.replaceChildren();
  root = document.createElement('div');
  root.className = 'hud';
  document.body.append(root);
  hud = new Hud(root);
});

describe('hud — leitura', () => {
  it('mostra pontos, comprimento, acertos e recorde', () => {
    hud.update(estado({ score: 40, correctCount: 4, wrongCount: 1 }), 90);
    expect(valores()).toEqual(['40', '3', '4 / 1', '90']);
  });

  it('o recorde acompanha quando a partida passa dele', () => {
    hud.update(estado({ score: 120 }), 90);
    expect(valores()[3]).toBe('120');
  });

  it('e texto no DOM, anunciado a leitores de tela', () => {
    expect(root.getAttribute('role')).toBe('status');
    expect(root.getAttribute('aria-live')).toBe('polite');
  });
});

describe('hud — pulso do placar', () => {
  it('o valor que muda pulsa; os que ficam iguais, nao', () => {
    // Recorde alto de proposito: assim so a pontuacao muda nesta atualizacao.
    hud.update(estado({ score: 0 }), 900);
    root
      .querySelectorAll('.hud__value')
      .forEach((n) => n.classList.remove('hud__value--bump'));

    hud.update(estado({ score: 10 }), 900);
    expect(pulsando()).toEqual(['10']);
  });

  it('atualizar com os mesmos numeros nao pulsa de novo', () => {
    hud.update(estado({ score: 10 }), 900);
    root
      .querySelectorAll('.hud__value')
      .forEach((n) => n.classList.remove('hud__value--bump'));

    hud.update(estado({ score: 10 }), 900);
    expect(pulsando()).toEqual([]);
  });

  it('acerto move pontos e acertos ao mesmo tempo', () => {
    hud.update(estado({ score: 0, correctCount: 0 }), 900);
    root
      .querySelectorAll('.hud__value')
      .forEach((n) => n.classList.remove('hud__value--bump'));

    hud.update(estado({ score: 10, correctCount: 1 }), 900);
    expect(pulsando()).toEqual(['10', '1 / 0']);
  });

  it('bater o proprio recorde faz o recorde pulsar junto', () => {
    hud.update(estado({ score: 0 }), 0);
    root
      .querySelectorAll('.hud__value')
      .forEach((n) => n.classList.remove('hud__value--bump'));

    hud.update(estado({ score: 10 }), 0);
    expect(pulsando()).toEqual(['10', '10']);
  });
});

describe('hud — sequencia de acertos', () => {
  it('guarda a sequencia num atributo, que o CSS usa para acender o placar', () => {
    hud.update(estado({ streak: 0 }), 0);
    expect(root.dataset.streak).toBe('0');
    hud.update(estado({ streak: 3 }), 0);
    expect(root.dataset.streak).toBe('3');
  });
});
