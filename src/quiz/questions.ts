import seed from '../../content/questions.seed.json';
import type { Focus, Question } from '../types';
import { acceptedForms, normalize } from './answer';

export const GAP = '___';

const FOCUSES: readonly Focus[] = ['simple-past', 'past-perfect', 'contrast'];
const LEVELS = [1, 2, 3];

export class QuestionBankError extends Error {
  constructor(readonly problems: string[]) {
    super(`Banco de questoes invalido:\n- ${problems.join('\n- ')}`);
    this.name = 'QuestionBankError';
  }
}

/** Valida o banco. Retorna a lista de problemas — vazia quando esta tudo certo. */
export function validateQuestions(data: unknown): string[] {
  const problems: string[] = [];
  if (!Array.isArray(data)) return ['O banco precisa ser um array de questoes.'];
  if (data.length === 0) problems.push('O banco esta vazio.');

  const seen = new Set<string>();
  data.forEach((raw, index) => {
    const where = `questao #${index + 1}`;
    if (typeof raw !== 'object' || raw === null) {
      problems.push(`${where}: nao e um objeto.`);
      return;
    }
    const q = raw as Partial<Question>;
    const id = typeof q.id === 'string' ? q.id : '';
    const label = id ? `"${id}"` : where;

    if (!id) problems.push(`${where}: campo "id" ausente ou invalido.`);
    else if (seen.has(id)) problems.push(`${label}: id duplicado.`);
    else seen.add(id);

    if (typeof q.level !== 'number' || !LEVELS.includes(q.level)) {
      problems.push(`${label}: "level" precisa ser 1, 2 ou 3.`);
    }
    if (typeof q.focus !== 'string' || !FOCUSES.includes(q.focus as Focus)) {
      problems.push(`${label}: "focus" precisa ser simple-past, past-perfect ou contrast.`);
    }
    if (typeof q.sentence !== 'string' || !q.sentence.includes(GAP)) {
      problems.push(`${label}: a frase precisa conter a lacuna "${GAP}".`);
    }
    if (typeof q.verbHint !== 'string' || q.verbHint.trim() === '') {
      problems.push(`${label}: "verbHint" ausente.`);
    }
    if (typeof q.explanation !== 'string' || q.explanation.trim() === '') {
      problems.push(`${label}: "explanation" ausente.`);
    }

    const options = q.options;
    if (!Array.isArray(options) || options.length !== 4) {
      problems.push(`${label}: "options" precisa ter exatamente 4 alternativas.`);
      return;
    }
    if (options.some((option) => typeof option !== 'string' || option.trim() === '')) {
      problems.push(`${label}: alternativas precisam ser textos nao vazios.`);
      return;
    }
    if (new Set(options.map(normalize)).size !== options.length) {
      problems.push(`${label}: alternativas repetidas.`);
    }

    const answerIndex = q.answerIndex;
    if (typeof answerIndex !== 'number' || answerIndex < 0 || answerIndex >= options.length) {
      problems.push(`${label}: "answerIndex" fora do intervalo 0..3.`);
      return;
    }
    if (!Array.isArray(q.accepted) || q.accepted.length === 0) {
      problems.push(`${label}: "accepted" ausente ou vazio.`);
      return;
    }

    const correct = normalize(String(options[answerIndex]));
    const forms = new Set(q.accepted.map((value) => normalize(String(value))));
    if (!forms.has(correct)) {
      problems.push(`${label}: "accepted" nao contem a alternativa correta ("${correct}").`);
    }
  });

  return problems;
}

/** Carrega o banco embutido. Lanca QuestionBankError se estiver inconsistente. */
export function loadQuestions(data: unknown = seed): Question[] {
  const problems = validateQuestions(data);
  if (problems.length > 0) throw new QuestionBankError(problems);
  return (data as Question[]).map((question) => ({
    ...question,
    options: [...question.options],
    accepted: [...new Set([...question.accepted, ...acceptedForms(question)])],
  }));
}

export const QUESTION_BANK: readonly unknown[] = seed as readonly unknown[];
