import type { AnswerMode } from '../types';
import { el } from './dom';
import {
  FOCUS_LABEL,
  REASON_LABEL,
  formatDuration,
  type Report,
} from './report';

export interface OverlayCallbacks {
  onStart: (mode: AnswerMode) => void;
  onResume: () => void;
  onRestart: () => void;
  onCopyReport: () => Promise<boolean>;
}

/** Camada sobre o canvas: inicio, pausa, contagem e relatorio final. */
export class Overlays {
  private mode: AnswerMode = 'choice';

  constructor(
    private readonly root: HTMLElement,
    private readonly callbacks: OverlayCallbacks,
  ) {}

  get answerMode(): AnswerMode {
    return this.mode;
  }

  hide(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  private show(...children: Array<Node | string>): HTMLElement {
    const panel = el('div', { class: 'panel' }, children);
    this.root.hidden = false;
    this.root.replaceChildren(panel);
    return panel;
  }

  showIdle(bestScore: number): void {
    const modeGroup = el('div', {
      class: 'modes',
      role: 'radiogroup',
      'aria-label': 'Como responder',
    });
    const options: Array<[AnswerMode, string, string]> = [
      ['choice', 'Multipla escolha', 'Escolha entre 4 alternativas (teclas 1 a 4).'],
      ['typed', 'Digitando', 'Escreva a forma verbal e confirme com Enter.'],
    ];
    const buttons = options.map(([mode, label, help]) => {
      const button = el(
        'button',
        {
          type: 'button',
          class: 'mode',
          role: 'radio',
          'aria-checked': String(this.mode === mode),
          title: help,
        },
        [label],
      );
      button.addEventListener('click', () => {
        this.mode = mode;
        buttons.forEach((other, index) => {
          const isCurrent = options[index]?.[0] === mode;
          other.setAttribute('aria-checked', String(isCurrent));
          other.classList.toggle('mode--on', isCurrent);
        });
      });
      button.classList.toggle('mode--on', this.mode === mode);
      return button;
    });
    modeGroup.append(...buttons);

    const start = el('button', {
      type: 'button',
      class: 'button button--primary',
      text: 'Comecar',
    });
    start.addEventListener('click', () => this.callbacks.onStart(this.mode));

    this.show(
      el('h2', { class: 'panel__title', text: 'Snake Grammar' }),
      el('p', {
        class: 'panel__lead',
        text: 'Coma a fruta, responda a frase em ingles. Acertou, a cobra cresce. Errou, ela encolhe.',
      }),
      modeGroup,
      start,
      el('p', { class: 'panel__note', text: `Recorde atual: ${bestScore} pontos` }),
      el('p', {
        class: 'panel__note',
        text: 'Setas ou WASD movem. Espaco ou Esc pausam. Enter comeca.',
      }),
    );
    start.focus();
  }

  showPaused(): void {
    const resume = el('button', {
      type: 'button',
      class: 'button button--primary',
      text: 'Continuar',
    });
    resume.addEventListener('click', () => this.callbacks.onResume());
    this.show(
      el('h2', { class: 'panel__title', text: 'Jogo pausado' }),
      el('p', { class: 'panel__lead', text: 'Aperte Espaco ou Esc para voltar.' }),
      resume,
    );
    resume.focus();
  }

  showCountdown(value: number): void {
    this.root.hidden = false;
    this.root.replaceChildren(
      el('div', { class: 'countdown', 'aria-hidden': 'true' }, [String(value)]),
    );
  }

  showGameOver(report: Report): void {
    const again = el('button', {
      type: 'button',
      class: 'button button--primary',
      text: 'Jogar de novo',
    });
    again.addEventListener('click', () => this.callbacks.onRestart());

    const copy = el('button', { type: 'button', class: 'button', text: 'Copiar relatorio' });
    copy.addEventListener('click', () => {
      void this.callbacks.onCopyReport().then((done) => {
        copy.textContent = done ? 'Relatorio copiado' : 'Nao foi possivel copiar';
      });
    });

    this.show(
      el('h2', { class: 'panel__title', text: 'Fim de jogo' }),
      el('p', {
        class: 'panel__lead',
        text: report.reason ? REASON_LABEL[report.reason] : 'Partida encerrada.',
      }),
      summary(report),
      focusTable(report),
      missedList(report),
      el('div', { class: 'panel__actions' }, [again, copy]),
    );
    again.focus();
  }
}

function summary(report: Report): HTMLElement {
  const rows: Array<[string, string]> = [
    ['Pontuacao', String(report.score)],
    ['Recorde', String(report.bestScore)],
    ['Comprimento final', String(report.finalLength)],
    ['Tempo total', formatDuration(report.durationMs)],
    ['Acertos / erros', `${report.correct} / ${report.wrong}`],
    ['Precisao', `${report.accuracy}%`],
  ];
  return el(
    'dl',
    { class: 'summary' },
    rows.flatMap(([label, value]) => [
      el('dt', { text: label }),
      el('dd', { text: value }),
    ]),
  );
}

function focusTable(report: Report): HTMLElement {
  return el('div', { class: 'focus-table' }, [
    el('h3', { class: 'panel__subtitle', text: 'Por tempo verbal' }),
    el(
      'ul',
      { class: 'focus-table__list' },
      report.byFocus.map((row) =>
        el('li', {}, [
          el('span', { class: 'focus-table__name', text: FOCUS_LABEL[row.focus] }),
          el('span', {
            class: 'focus-table__score',
            text: `${row.correct} certas, ${row.wrong} erradas`,
          }),
        ]),
      ),
    ),
  ]);
}

function missedList(report: Report): HTMLElement {
  if (report.missed.length === 0) {
    return el('p', { class: 'panel__note', text: 'Nenhum erro nesta partida.' });
  }
  return el('div', { class: 'missed' }, [
    el('h3', { class: 'panel__subtitle', text: 'Para revisar' }),
    el(
      'ol',
      { class: 'missed__list' },
      report.missed.map((item) =>
        el('li', { class: 'missed__item' }, [
          el('p', { class: 'missed__sentence', lang: 'en', text: item.sentence }),
          el('p', { class: 'missed__answer', text: `Resposta certa: ${item.answer}` }),
          el('p', {
            class: 'missed__chosen',
            text: item.chosen
              ? `Voce marcou: ${item.chosen}`
              : 'Voce nao respondeu a tempo.',
          }),
          el('p', { class: 'missed__why', text: item.explanation }),
        ]),
      ),
    ),
  ]);
}
