import { describe, expect, it } from 'vitest';
import { createRng } from '../src/game/board';
import { loadQuestions } from '../src/quiz/questions';
import { QuestionSelector, levelForFruit, presentQuestion } from '../src/quiz/selector';
import type { Question } from '../src/types';

function makeQuestion(id: string, level: 1 | 2 | 3): Question {
  return {
    id,
    level,
    focus: 'simple-past',
    sentence: `We ___ it. (${id})`,
    verbHint: 'do',
    options: ['did', 'had done', 'have done', 'do'],
    answerIndex: 0,
    accepted: ['did'],
    explanation: 'Explicacao.',
  };
}

function bankOfLevel(level: 1 | 2 | 3, count: number): Question[] {
  return Array.from({ length: count }, (_, i) => makeQuestion(`${level}-${i}`, level));
}

describe('selector — sem repeticao', () => {
  it('nao repete questao enquanto houver questoes nao usadas', () => {
    const bank = bankOfLevel(1, 12);
    const selector = new QuestionSelector(bank, createRng(99));
    const seen = new Set<string>();
    for (let i = 0; i < bank.length; i += 1) {
      const question = selector.next();
      expect(seen.has(question.id)).toBe(false);
      seen.add(question.id);
    }
    expect(seen.size).toBe(bank.length);
  });

  it('so repete depois que o banco acaba', () => {
    const bank = bankOfLevel(1, 4);
    const selector = new QuestionSelector(bank, createRng(3));
    const drawn = Array.from({ length: 8 }, () => selector.next().id);
    expect(new Set(drawn.slice(0, 4)).size).toBe(4);
    expect(new Set(drawn.slice(4, 8)).size).toBe(4);
  });

  it('embaralha de forma determinista com o mesmo seed', () => {
    const bank = bankOfLevel(1, 10);
    const a = new QuestionSelector(bank, createRng(7));
    const b = new QuestionSelector(bank, createRng(7));
    const drawA = Array.from({ length: 10 }, () => a.next().id);
    const drawB = Array.from({ length: 10 }, () => b.next().id);
    expect(drawA).toEqual(drawB);
  });
});

describe('selector — repescagem', () => {
  it('questao errada reaparece dentro da janela de 3 a 6', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      const selector = new QuestionSelector(bankOfLevel(1, 30), createRng(seed));
      const wrong = selector.next();
      selector.requeue(wrong);
      const following = Array.from({ length: 10 }, () => selector.next().id);
      const position = following.indexOf(wrong.id) + 1;
      expect(position).toBeGreaterThanOrEqual(3);
      expect(position).toBeLessThanOrEqual(6);
    }
  });

  it('a questao repescada e servida mesmo em outra faixa de nivel', () => {
    const bank = [...bankOfLevel(1, 8), ...bankOfLevel(2, 8), ...bankOfLevel(3, 8)];
    const selector = new QuestionSelector(bank, createRng(11));
    const wrong = selector.next();
    selector.requeue(wrong);
    const following = Array.from({ length: 8 }, () => selector.next().id);
    expect(following).toContain(wrong.id);
  });
});

describe('selector — progressao de nivel', () => {
  it('as faixas de fruta mapeiam para os niveis certos', () => {
    expect([1, 2, 3, 4, 5].map(levelForFruit)).toEqual([1, 1, 1, 1, 1]);
    expect([6, 7, 11, 12].map(levelForFruit)).toEqual([2, 2, 2, 2]);
    expect([13, 20, 99].map(levelForFruit)).toEqual([3, 3, 3]);
  });

  it('as 5 primeiras frutas puxam nivel 1, 6 a 12 nivel 2, dai nivel 3', () => {
    const bank = [...bankOfLevel(1, 10), ...bankOfLevel(2, 10), ...bankOfLevel(3, 10)];
    const selector = new QuestionSelector(bank, createRng(5));
    const levels = Array.from({ length: 16 }, () => selector.next().level);
    expect(levels.slice(0, 5)).toEqual([1, 1, 1, 1, 1]);
    expect(levels.slice(5, 12)).toEqual([2, 2, 2, 2, 2, 2, 2]);
    expect(levels.slice(12, 16)).toEqual([3, 3, 3, 3]);
  });

  it('cai para o nivel mais proximo quando o nivel alvo acabou', () => {
    const bank = [...bankOfLevel(1, 2), ...bankOfLevel(3, 6)];
    const selector = new QuestionSelector(bank, createRng(21));
    const levels = Array.from({ length: 6 }, () => selector.next().level);
    expect(levels.slice(0, 2)).toEqual([1, 1]);
    // Sem nivel 1 sobrando nas frutas 3..5, o nivel mais proximo disponivel e o 3.
    expect(levels.slice(2, 5)).toEqual([3, 3, 3]);
  });
});

describe('selector — apresentacao', () => {
  it('embaralha as alternativas e recalcula o indice correto', () => {
    const question = loadQuestions()[0] as Question;
    for (let seed = 0; seed < 40; seed += 1) {
      const presented = presentQuestion(question, createRng(seed));
      expect(presented.options.length).toBe(4);
      expect([...presented.options].sort()).toEqual([...question.options].sort());
      expect(presented.options[presented.answerIndex]).toBe(
        question.options[question.answerIndex],
      );
    }
  });

  it('produz ao menos uma ordem diferente da original', () => {
    const question = loadQuestions()[0] as Question;
    const orders = new Set(
      Array.from({ length: 20 }, (_, seed) =>
        presentQuestion(question, createRng(seed)).options.join('|'),
      ),
    );
    expect(orders.size).toBeGreaterThan(1);
  });
});
