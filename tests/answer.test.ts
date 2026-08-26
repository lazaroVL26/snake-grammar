import { describe, expect, it } from 'vitest';
import {
  correctAnswer,
  fillGap,
  isChoiceCorrect,
  isTypedAnswerCorrect,
  normalize,
} from '../src/quiz/answer';
import type { Question } from '../src/types';

const question: Question = {
  id: 'pp-x',
  level: 1,
  focus: 'past-perfect',
  sentence: 'By the time we arrived, the concert ___.',
  verbHint: 'finish',
  options: ['had finished', 'finishes', 'has finished', 'was finishing'],
  answerIndex: 0,
  accepted: ['had finished', "'d finished"],
  explanation: 'Explicacao.',
};

describe('answer — normalize', () => {
  it('baixa maiusculas', () => {
    expect(normalize('HAD Finished')).toBe('had finished');
  });

  it('colapsa espaco duplo e apara as pontas', () => {
    expect(normalize('  had   finished ')).toBe('had finished');
  });

  it('converte apostrofo tipografico em reto', () => {
    expect(normalize('’d finished')).toBe("'d finished");
  });

  it('remove pontuacao final', () => {
    expect(normalize('had finished.')).toBe('had finished');
  });
});

describe('answer — modo digitado', () => {
  it('aceita a forma completa', () => {
    expect(isTypedAnswerCorrect(question, 'had finished')).toBe(true);
  });

  it('aceita a contracao com apostrofo reto e tipografico', () => {
    expect(isTypedAnswerCorrect(question, "'d finished")).toBe(true);
    expect(isTypedAnswerCorrect(question, '’d finished')).toBe(true);
  });

  it('aceita variacao de caixa, espaco e ponto final', () => {
    expect(isTypedAnswerCorrect(question, '  Had  Finished. ')).toBe(true);
  });

  it('nao aceita resposta com outro verbo', () => {
    expect(isTypedAnswerCorrect(question, 'had ended')).toBe(false);
    expect(isTypedAnswerCorrect(question, 'finished')).toBe(false);
  });

  it('nao tolera erro de digitacao no verbo', () => {
    expect(isTypedAnswerCorrect(question, 'had finishd')).toBe(false);
    expect(isTypedAnswerCorrect(question, 'hd finished')).toBe(false);
  });

  it('nao aceita resposta vazia', () => {
    expect(isTypedAnswerCorrect(question, '   ')).toBe(false);
  });

  it('aceita a negativa contraida e por extenso', () => {
    const negative: Question = {
      ...question,
      options: ["didn't", 'did', 'had not', 'not'],
      answerIndex: 0,
      accepted: ["didn't", 'did not'],
    };
    expect(isTypedAnswerCorrect(negative, 'did not')).toBe(true);
    expect(isTypedAnswerCorrect(negative, "DIDN'T")).toBe(true);
  });
});

describe('answer — multipla escolha e utilitarios', () => {
  it('compara a alternativa marcada de forma normalizada', () => {
    expect(isChoiceCorrect(question, 'had finished')).toBe(true);
    expect(isChoiceCorrect(question, 'has finished')).toBe(false);
  });

  it('correctAnswer devolve o texto da alternativa certa', () => {
    expect(correctAnswer(question)).toBe('had finished');
  });

  it('fillGap preenche a lacuna', () => {
    expect(fillGap(question.sentence, 'had finished')).toBe(
      'By the time we arrived, the concert had finished.',
    );
  });
});
