import type { AnswerMode, TopicId } from '../types';
import { DEFAULT_TOPIC, TOPICS } from '../quiz/topics';
import { CONFIG } from '../config';
import { el } from './dom';
import { FOCUS_LABEL, REASON_LABEL, formatDuration, type Report } from './report';

/** Tudo que a tela inicial precisa mostrar. */
export interface IdleView {
  bestScore: number;
  nick: string;
  questionCount: (topic: TopicId) => number;
}

export interface OverlayCallbacks {
  onStart: (mode: AnswerMode, topic: TopicId, nick: string) => void;
  onResume: () => void;
  onRestart: () => void;
}

/** Camada sobre o canvas: inicio, pausa, contagem e relatorio final. */
export class Overlays {
  private mode: AnswerMode = 'choice';
  private topic: TopicId = DEFAULT_TOPIC;
  private nick = '';
  private nickField: HTMLInputElement | null = null;

  constructor(
    private readonly root: HTMLElement,
    private readonly callbacks: OverlayCallbacks,
  ) {}

  get answerMode(): AnswerMode {
    return this.mode;
  }

  get contentTopic(): TopicId {
    return this.topic;
  }

  get playerNick(): string {
    return this.nick;
  }

  /**
   * Comeca a partida se houver apelido. Sem apelido, leva o foco para o campo
   * em vez de comecar — o ranking do dia so faz sentido com nome.
   */
  requestStart(): void {
    const nick = (this.nickField?.value ?? this.nick).trim();
    if (nick === '') {
      this.nickField?.focus();
      const warning = this.root.querySelector('.nick__warning');
      if (warning) warning.textContent = 'Escreva seu apelido para entrar no ranking.';
      return;
    }
    this.nick = nick;
    this.callbacks.onStart(this.mode, this.topic, nick);
  }

  hide(): void {
    this.root.hidden = true;
    this.root.replaceChildren();
  }

  private show(...children: Array<Node | string>): HTMLElement {
    const panel = el('div', { class: 'panel card p-4' }, children);
    this.root.hidden = false;
    this.root.replaceChildren(panel);
    return panel;
  }

  showIdle(view: IdleView): void {
    this.nick = view.nick;

    const field = el('input', {
      type: 'text',
      class: 'nick__field form-control',
      id: 'nick',
      maxlength: CONFIG.NICK_MAX_LENGTH,
      autocomplete: 'off',
      placeholder: 'como voce aparece no ranking',
      value: view.nick,
    });
    field.value = view.nick;
    field.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      this.requestStart();
    });
    this.nickField = field;

    const nickBlock = el('div', { class: 'nick' }, [
      el('label', {
        class: 'choices__legend form-label',
        for: 'nick',
        text: 'Seu apelido',
      }),
      field,
      el('p', {
        class: 'nick__warning small mb-0',
        role: 'status',
        'aria-live': 'polite',
      }),
    ]);

    const topicGroup = radioGroup(
      'O que voce quer estudar?',
      TOPICS.map((topic) => ({
        value: topic.id,
        label: topic.label,
        detail: `${topic.summary} ${view.questionCount(topic.id)} frases.`,
      })),
      this.topic,
      (value) => (this.topic = value),
      'topics',
    );

    const modeGroup = radioGroup(
      'Como responder',
      [
        {
          value: 'choice' as AnswerMode,
          label: 'Multipla escolha',
          detail: 'Teclas 1 a 4.',
        },
        {
          value: 'typed' as AnswerMode,
          label: 'Digitando',
          detail: 'Escreva e confirme.',
        },
      ],
      this.mode,
      (value) => (this.mode = value),
      'modes',
    );

    const start = el('button', {
      type: 'button',
      class: 'button button--primary btn btn-primary btn-lg w-100',
      text: 'Comecar',
    });
    start.addEventListener('click', () => this.requestStart());

    this.show(
      el('h2', { class: 'panel__title', text: 'Snake Grammar' }),
      el('p', {
        class: 'panel__lead',
        text: 'Coma a fruta, responda a frase em ingles. Acertou, a cobra cresce. Errou, ela encolhe.',
      }),
      nickBlock,
      topicGroup,
      modeGroup,
      start,
      el('p', { class: 'panel__note', text: `Seu recorde: ${view.bestScore} pontos` }),
      el('p', {
        class: 'panel__note',
        text: 'Setas ou WASD movem. Espaco ou Esc pausam. Enter comeca.',
      }),
    );
    if (view.nick === '') field.focus();
    else start.focus();
  }

  showPaused(): void {
    const resume = el('button', {
      type: 'button',
      class: 'button button--primary btn btn-primary',
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

  /** Escreve a colocacao quando o servidor responde, sem remontar o painel. */
  setRankingPosition(label: string): void {
    const node = this.root.querySelector('.ranking__position');
    if (node) node.textContent = label;
  }

  showGameOver(report: Report): void {
    const again = el('button', {
      type: 'button',
      class: 'button button--primary btn btn-primary',
      text: 'Jogar de novo',
    });
    again.addEventListener('click', () => this.callbacks.onRestart());

    this.show(
      el('h2', { class: 'panel__title', text: 'Fim de jogo' }),
      el('p', {
        class: 'panel__lead',
        text: report.reason ? REASON_LABEL[report.reason] : 'Partida encerrada.',
      }),
      el('p', { class: 'panel__note', text: `Conteudo: ${report.topicLabel}` }),
      summary(report),
      focusTable(report),
      missedList(report),
      rankingBlock(),
      el('div', { class: 'panel__actions d-flex flex-wrap gap-2' }, [again]),
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
    { class: 'summary mb-0' },
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
      { class: 'focus-table__list list-group list-group-flush' },
      report.byFocus.map((row) =>
        el('li', { class: 'list-group-item px-0 py-1 border-0' }, [
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
        el('li', { class: 'missed__item mb-3' }, [
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

/** A lista completa fica na coluna ao lado; aqui so a colocacao, que chega depois. */
function rankingBlock(): HTMLElement {
  return el('p', {
    class: 'ranking__position alert alert-secondary py-2 mb-0',
    role: 'status',
    'aria-live': 'polite',
    text: 'Enviando para o ranking da turma...',
  });
}

interface RadioOption<T extends string> {
  value: T;
  label: string;
  detail: string;
}

/** Grupo de escolha unica navegavel por Tab, com estado em aria-checked. */
function radioGroup<T extends string>(
  legend: string,
  options: ReadonlyArray<RadioOption<T>>,
  selected: T,
  onPick: (value: T) => void,
  variant: string,
): HTMLElement {
  const list = el('div', {
    class: `choices choices--${variant} list-group`,
    role: 'radiogroup',
    'aria-label': legend,
  });

  const buttons = options.map((option) => {
    const button = el(
      'button',
      {
        type: 'button',
        class: 'choice list-group-item list-group-item-action',
        role: 'radio',
        'aria-checked': String(option.value === selected),
      },
      [
        el('span', { class: 'choice__label', text: option.label }),
        el('span', { class: 'choice__detail', text: option.detail }),
      ],
    );
    button.classList.toggle('choice--on', option.value === selected);
    button.addEventListener('click', () => {
      onPick(option.value);
      buttons.forEach((other, index) => {
        const isCurrent = options[index]?.value === option.value;
        other.setAttribute('aria-checked', String(isCurrent));
        other.classList.toggle('choice--on', isCurrent);
      });
    });
    return button;
  });

  list.append(el('p', { class: 'choices__legend form-label', text: legend }), ...buttons);
  return list;
}
