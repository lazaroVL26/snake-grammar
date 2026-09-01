import type { AttemptLog, Focus, GameOverReason, GameState, Question } from '../types';
import { correctAnswer, fillGap } from '../quiz/answer';

export const FOCUS_LABEL: Record<Focus, string> = {
  'simple-past': 'Simple Past',
  'past-continuous': 'Past Continuous',
  'past-perfect': 'Past Perfect',
  'past-perfect-continuous': 'Past Perfect Continuous',
  'present-simple': 'Present Simple',
  'present-continuous': 'Present Continuous',
  'present-perfect': 'Present Perfect',
  'present-perfect-continuous': 'Present Perfect Continuous',
  'future-will': 'Future — will',
  'future-going-to': 'Future — going to',
  'future-continuous': 'Future Continuous',
  'future-perfect': 'Future Perfect',
  contrast: 'Contraste',
};

/** Ordem estavel do relatorio: passado, presente, futuro. */
export const FOCUS_ORDER: readonly Focus[] = [
  'simple-past',
  'past-continuous',
  'past-perfect',
  'past-perfect-continuous',
  'contrast',
  'present-simple',
  'present-continuous',
  'present-perfect',
  'present-perfect-continuous',
  'future-will',
  'future-going-to',
  'future-continuous',
  'future-perfect',
];

export const REASON_LABEL: Record<GameOverReason, string> = {
  wall: 'A cobra bateu na parede.',
  self: 'A cobra bateu no proprio corpo.',
  'too-short': 'A cobra ficou curta demais.',
};

export interface FocusRow {
  focus: Focus;
  correct: number;
  wrong: number;
}

export interface MissedItem {
  sentence: string;
  chosen: string | null;
  answer: string;
  explanation: string;
  focus: Focus;
}

export interface Report {
  /** Apelido de quem jogou, para o professor saber de quem e o relatorio. */
  nick: string;
  /** Conteudo escolhido no menu, como o aluno leu na tela inicial. */
  topicLabel: string;
  score: number;
  bestScore: number;
  finalLength: number;
  durationMs: number;
  correct: number;
  wrong: number;
  accuracy: number;
  byFocus: FocusRow[];
  missed: MissedItem[];
  reason: GameOverReason | null;
}

export function buildReport(
  state: GameState,
  bestScore: number,
  questionsById: Map<string, Question>,
  now: number,
  topicLabel = 'Todos os tempos',
  nick = '',
): Report {
  const { correctCount, wrongCount, score } = state.stats;
  const total = correctCount + wrongCount;

  // So entram no relatorio os tempos que realmente cairam na partida.
  const byFocus: FocusRow[] = FOCUS_ORDER.map((focus) => ({
    focus,
    correct: count(state.attempts, focus, true),
    wrong: count(state.attempts, focus, false),
  })).filter((row) => row.correct + row.wrong > 0);

  const missed: MissedItem[] = state.attempts
    .filter((attempt) => !attempt.correct)
    .map((attempt) => {
      const question = questionsById.get(attempt.questionId);
      const answer = question ? correctAnswer(question) : '';
      return {
        sentence: question ? fillGap(question.sentence, answer) : attempt.questionId,
        chosen: attempt.chosen,
        answer,
        explanation: question?.explanation ?? '',
        focus: attempt.focus,
      };
    });

  return {
    nick,
    topicLabel,
    score,
    bestScore,
    finalLength: state.snake.segments.length,
    durationMs: Math.max(0, (state.endedAt ?? now) - state.startedAt),
    correct: correctCount,
    wrong: wrongCount,
    accuracy: total === 0 ? 0 : Math.round((correctCount / total) * 100),
    byFocus,
    missed,
    reason: state.gameOverReason,
  };
}

function count(attempts: readonly AttemptLog[], focus: Focus, correct: boolean): number {
  return attempts.filter((a) => a.focus === focus && a.correct === correct).length;
}

export function formatDuration(ms: number): string {
  const totalSeconds = Math.round(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}min ${String(seconds).padStart(2, '0')}s`;
}

/** Resumo em texto puro para o aluno colar no caderno ou no Moodle. */
export function reportToText(report: Report): string {
  const lines: string[] = [
    'Snake Grammar',
    ...(report.nick ? [`Aluno: ${report.nick}`] : []),
    `Conteudo: ${report.topicLabel}`,
    `Pontuacao: ${report.score} (recorde: ${report.bestScore})`,
    `Comprimento final: ${report.finalLength} | Tempo: ${formatDuration(report.durationMs)}`,
    `Acertos: ${report.correct} | Erros: ${report.wrong} | Precisao: ${report.accuracy}%`,
    '',
    'Desempenho por tempo verbal:',
    ...report.byFocus.map(
      (row) => `- ${FOCUS_LABEL[row.focus]}: ${row.correct} acertos, ${row.wrong} erros`,
    ),
  ];

  if (report.missed.length > 0) {
    lines.push('', 'Para revisar:');
    report.missed.forEach((item, index) => {
      lines.push(`${index + 1}. ${item.sentence}`);
      lines.push(`   Resposta certa: ${item.answer}`);
      if (item.chosen) lines.push(`   Voce marcou: ${item.chosen}`);
      else lines.push('   Voce nao respondeu a tempo.');
      lines.push(`   ${item.explanation}`);
    });
  } else {
    lines.push('', 'Nenhum erro nesta partida.');
  }

  return lines.join('\n');
}
