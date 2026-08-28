import { describe, expect, it } from 'vitest';
import seed from '../content/questions.seed.json';
import {
  GAP,
  QuestionBankError,
  loadQuestions,
  validateQuestions,
} from '../src/quiz/questions';
import { normalize } from '../src/quiz/answer';
import type { Question } from '../src/types';

const bank = seed as Question[];

describe('questions.seed.json — integridade do arquivo real', () => {
  it('carrega sem erro de validacao', () => {
    expect(validateQuestions(bank)).toEqual([]);
    expect(loadQuestions().length).toBe(bank.length);
  });

  it('tem ids unicos', () => {
    const ids = bank.map((question) => question.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('toda questao tem exatamente 4 opcoes distintas', () => {
    for (const question of bank) {
      expect(question.options.length, question.id).toBe(4);
      expect(new Set(question.options.map(normalize)).size, question.id).toBe(4);
    }
  });

  it('answerIndex sempre aponta para uma opcao existente', () => {
    for (const question of bank) {
      expect(question.answerIndex, question.id).toBeGreaterThanOrEqual(0);
      expect(question.answerIndex, question.id).toBeLessThan(question.options.length);
    }
  });

  it('toda frase tem exatamente uma lacuna', () => {
    for (const question of bank) {
      expect(question.sentence.split(GAP).length - 1, question.id).toBe(1);
    }
  });

  it('accepted contem a alternativa correta normalizada', () => {
    for (const question of bank) {
      const correct = normalize(String(question.options[question.answerIndex]));
      expect(question.accepted.map(normalize), question.id).toContain(correct);
    }
  });

  it('level e focus estao dentro dos valores permitidos', () => {
    for (const question of bank) {
      expect([1, 2, 3], question.id).toContain(question.level);
      expect(['simple-past', 'past-perfect', 'contrast'], question.id).toContain(
        question.focus,
      );
    }
  });

  it('toda questao tem explicacao em texto', () => {
    for (const question of bank) {
      expect(question.explanation.trim().length, question.id).toBeGreaterThan(0);
    }
  });

  it('cobre os tres niveis e os tres focos', () => {
    expect(new Set(bank.map((q) => q.level)).size).toBe(3);
    expect(new Set(bank.map((q) => q.focus)).size).toBe(3);
  });
});

describe('questions — validacao falha alto e claro', () => {
  const valid = bank[0] as Question;

  it('acusa id duplicado', () => {
    const problems = validateQuestions([valid, { ...valid }]);
    expect(problems.join(' ')).toContain('id duplicado');
  });

  it('acusa answerIndex fora do intervalo', () => {
    expect(validateQuestions([{ ...valid, answerIndex: 9 }]).join(' ')).toContain(
      'answerIndex',
    );
  });

  it('acusa numero de opcoes diferente de 4', () => {
    expect(
      validateQuestions([{ ...valid, options: ['a', 'b'], answerIndex: 0 }]).join(' '),
    ).toContain('4 alternativas');
  });

  it('acusa frase sem lacuna', () => {
    expect(validateQuestions([{ ...valid, sentence: 'sem lacuna' }]).join(' ')).toContain(
      GAP,
    );
  });

  it('acusa accepted que nao contem a correta', () => {
    expect(validateQuestions([{ ...valid, accepted: ['xyz'] }]).join(' ')).toContain(
      'accepted',
    );
  });

  it('loadQuestions lanca QuestionBankError com a lista de problemas', () => {
    expect(() => loadQuestions([{ ...valid, answerIndex: 9 }])).toThrow(
      QuestionBankError,
    );
  });
});
