import { describe, expect, it } from 'vitest';
import { createRng } from '../src/game/board';
import { loadQuestions, questionsForTopic } from '../src/quiz/questions';
import { QuestionSelector } from '../src/quiz/selector';
import { DEFAULT_TOPIC, TOPICS, findTopic, includesFocus } from '../src/quiz/topics';
import type { Focus } from '../src/types';

const bank = loadQuestions();

describe('topics — definicao do menu', () => {
  it('tem os cinco conteudos, com id unico', () => {
    const ids = TOPICS.map((topic) => topic.id);
    expect(ids).toEqual(['past-contrast', 'present', 'past', 'future', 'all']);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('o padrao e o conteudo original de Simple Past x Past Perfect', () => {
    expect(DEFAULT_TOPIC).toBe('past-contrast');
    expect(findTopic(DEFAULT_TOPIC).focuses).toContain('simple-past');
  });

  it('findTopic reclama de conteudo desconhecido', () => {
    // @ts-expect-error id invalido de proposito
    expect(() => findTopic('nao-existe')).toThrow('Conteudo desconhecido');
  });

  it('"all" aceita qualquer tempo verbal', () => {
    const all = findTopic('all');
    expect(all.focuses.length).toBe(0);
    expect(includesFocus(all, 'future-perfect')).toBe(true);
    expect(includesFocus(all, 'simple-past')).toBe(true);
  });

  it('os demais conteudos filtram pelos proprios tempos', () => {
    const future = findTopic('future');
    expect(includesFocus(future, 'future-will')).toBe(true);
    expect(includesFocus(future, 'simple-past')).toBe(false);
  });
});

describe('topics — filtro do banco', () => {
  it('"all" devolve o banco inteiro', () => {
    expect(questionsForTopic(findTopic('all'), bank).length).toBe(bank.length);
  });

  it('cada conteudo devolve apenas questoes dos seus tempos', () => {
    for (const topic of TOPICS) {
      const questions = questionsForTopic(topic, bank);
      expect(questions.length, topic.id).toBeGreaterThan(0);
      for (const question of questions) {
        expect(includesFocus(topic, question.focus), `${topic.id}/${question.id}`).toBe(
          true,
        );
      }
    }
  });

  it('presente, passado e futuro nao se misturam', () => {
    const focusesOf = (id: 'present' | 'past' | 'future'): Set<Focus> =>
      new Set(questionsForTopic(findTopic(id), bank).map((question) => question.focus));

    const present = focusesOf('present');
    const future = focusesOf('future');
    const past = focusesOf('past');

    for (const focus of present) expect(future.has(focus), focus).toBe(false);
    for (const focus of present) expect(past.has(focus), focus).toBe(false);
    for (const focus of future) expect(past.has(focus), focus).toBe(false);
  });

  it('o conteudo original continua com as 41 frases do banco antigo', () => {
    const original = questionsForTopic(findTopic('past-contrast'), bank);
    expect(original.length).toBe(41);
  });

  it('somando presente, passado e futuro chega-se ao banco inteiro', () => {
    const ids = new Set<string>();
    for (const id of ['present', 'past', 'future'] as const) {
      for (const question of questionsForTopic(findTopic(id), bank)) ids.add(question.id);
    }
    expect(ids.size).toBe(bank.length);
  });
});

describe('topics — jogar um conteudo do inicio ao fim', () => {
  it('o seletor so entrega questoes do conteudo escolhido', () => {
    for (const topic of TOPICS) {
      const pool = questionsForTopic(topic, bank);
      const selector = new QuestionSelector(pool, createRng(17));
      for (let fruit = 0; fruit < 30; fruit += 1) {
        const question = selector.next();
        expect(includesFocus(topic, question.focus), topic.id).toBe(true);
      }
    }
  });

  it('a progressao de nivel funciona dentro de cada conteudo', () => {
    for (const topic of TOPICS) {
      const selector = new QuestionSelector(questionsForTopic(topic, bank), createRng(5));
      const levels = Array.from({ length: 13 }, () => selector.next().level);
      expect(levels.slice(0, 5), topic.id).toEqual([1, 1, 1, 1, 1]);
      expect(levels.slice(5, 12), topic.id).toEqual([2, 2, 2, 2, 2, 2, 2]);
      expect(levels[12], topic.id).toBe(3);
    }
  });
});
