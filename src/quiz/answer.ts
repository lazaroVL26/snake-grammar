import type { Question } from '../types';

const CURLY_APOSTROPHES = /[‘’ʼ´`]/g;

/**
 * Normaliza para comparacao: minusculas, apostrofo tipografico virando reto,
 * espacos colapsados e pontuacao final removida. O verbo em si nao ganha
 * tolerancia a erro de digitacao — e exatamente o que esta sendo avaliado.
 */
export function normalize(value: string): string {
  return value
    .replace(CURLY_APOSTROPHES, "'")
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[.,!?;:]+$/g, '')
    .trim();
}

/** "had left" e "'d left" sao a mesma resposta: gera as duas formas. */
export function contractionVariants(value: string): string[] {
  const base = normalize(value);
  const variants = new Set<string>([base]);
  if (base.startsWith('had ')) variants.add(`'d ${base.slice(4)}`);
  if (base.startsWith("'d ")) variants.add(`had ${base.slice(3)}`);
  if (base.startsWith('did not ')) variants.add(`didn't ${base.slice(8)}`);
  if (base.startsWith("didn't ")) variants.add(`did not ${base.slice(7)}`);
  if (base === 'did not') variants.add("didn't");
  if (base === "didn't") variants.add('did not');
  return [...variants];
}

/** Conjunto de todas as formas aceitas de uma questao, ja normalizadas. */
export function acceptedForms(question: Question): Set<string> {
  const forms = new Set<string>();
  const correct = question.options[question.answerIndex];
  if (correct !== undefined) {
    for (const variant of contractionVariants(correct)) forms.add(variant);
  }
  for (const accepted of question.accepted) {
    for (const variant of contractionVariants(accepted)) forms.add(variant);
  }
  return forms;
}

/** Verificacao do modo digitado. */
export function isTypedAnswerCorrect(question: Question, typed: string): boolean {
  const value = normalize(typed);
  if (value.length === 0) return false;
  return acceptedForms(question).has(value);
}

/** Verificacao do modo multipla escolha, pelo texto da alternativa marcada. */
export function isChoiceCorrect(question: Question, chosen: string): boolean {
  const correct = question.options[question.answerIndex];
  return correct !== undefined && normalize(correct) === normalize(chosen);
}

export function correctAnswer(question: Question): string {
  return question.options[question.answerIndex] ?? '';
}

/** Frase completa com a lacuna preenchida, usada no feedback e no relatorio. */
export function fillGap(sentence: string, value: string): string {
  return sentence.replace('___', value);
}
