import { CONFIG } from '../config';
import {
  correctAnswer,
  isChoiceCorrect,
  isTypedAnswerCorrect,
  normalize,
} from '../quiz/answer';
import type { PresentedQuestion } from '../quiz/selector';
import type { AnswerMode } from '../types';
import { el, focusableIn } from './dom';
import { FOCUS_LABEL } from './report';

export interface AnswerResult {
  chosen: string | null;
  correct: boolean;
  elapsedMs: number;
}

export interface QuestionModalCallbacks {
  /** Chamado assim que a resposta e enviada ou o tempo estoura. */
  onAnswered: (result: AnswerResult) => void;
  /** Chamado quando o feedback termina e o modal fecha. */
  onDismissed: () => void;
}

const KEY_TO_INDEX: Record<string, number> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
};

export class QuestionModal {
  private readonly backdrop: HTMLElement;
  private readonly dialog: HTMLElement;
  private readonly focusLabel: HTMLElement;
  private readonly timerBar: HTMLElement;
  private readonly timerText: HTMLElement;
  private readonly sentence: HTMLElement;
  private readonly gap: HTMLElement;
  private readonly hint: HTMLElement;
  private readonly answers: HTMLElement;
  private readonly feedback: HTMLElement;
  private readonly submit: HTMLButtonElement;

  private presented: PresentedQuestion | null = null;
  private mode: AnswerMode = 'choice';
  private selected = -1;
  private input: HTMLInputElement | null = null;
  private buttons: HTMLButtonElement[] = [];
  private startedAt = 0;
  private frame: number | null = null;
  private timeout: number | null = null;
  private answered = false;

  constructor(
    root: HTMLElement,
    private readonly callbacks: QuestionModalCallbacks,
  ) {
    this.focusLabel = el('span', { class: 'modal__focus' });
    this.timerBar = el('div', { class: 'timer__bar progress-bar' });
    this.timerText = el('span', { class: 'timer__text' });
    this.gap = el('span', { class: 'gap', text: '___' });
    this.sentence = el('p', { class: 'sentence', lang: 'en' });
    this.hint = el('p', { class: 'hint mb-0' });
    this.answers = el('div', { class: 'answers list-group' });
    this.feedback = el('div', {
      class: 'feedback',
      'aria-live': 'assertive',
      role: 'status',
    });
    this.submit = el('button', {
      type: 'button',
      class: 'button button--primary btn btn-primary',
      text: 'Responder',
    });
    this.submit.addEventListener('click', () => this.confirm());

    this.dialog = el(
      'div',
      {
        class: 'question-modal card p-4',
        role: 'dialog',
        'aria-modal': 'true',
        'aria-labelledby': 'modal-title',
      },
      [
        el('div', { class: 'modal__head' }, [
          el('h2', {
            id: 'modal-title',
            class: 'modal__title mb-0',
            text: 'Complete a frase',
          }),
          this.focusLabel,
        ]),
        el('div', { class: 'timer d-flex align-items-center gap-2' }, [
          el('div', { class: 'timer__track progress flex-grow-1' }, [this.timerBar]),
          this.timerText,
        ]),
        this.sentence,
        this.hint,
        this.answers,
        this.feedback,
        el('div', { class: 'modal__foot d-flex justify-content-end' }, [this.submit]),
      ],
    );

    this.backdrop = el('div', { class: 'backdrop', hidden: true }, [this.dialog]);
    this.backdrop.addEventListener('keydown', (event) => this.onKeyDown(event));
    root.append(this.backdrop);
  }

  open(presented: PresentedQuestion, mode: AnswerMode): void {
    this.presented = presented;
    this.mode = mode;
    this.selected = -1;
    this.answered = false;
    this.startedAt = performance.now();

    this.focusLabel.textContent = FOCUS_LABEL[presented.question.focus];
    this.gap.className = 'gap';
    this.gap.textContent = '___';
    this.renderSentence(presented.question.sentence);
    this.hint.textContent = `Verbo: ${presented.question.verbHint}`;
    this.feedback.textContent = '';
    this.feedback.className = 'feedback';
    this.submit.disabled = false;
    this.renderAnswers();

    this.backdrop.hidden = false;
    this.tick();
    const first = this.input ?? this.buttons[0] ?? this.submit;
    first.focus();
  }

  destroy(): void {
    this.stopTimers();
    this.backdrop.remove();
  }

  private renderSentence(sentence: string): void {
    const [before = '', after = ''] = sentence.split('___');
    this.sentence.replaceChildren(
      document.createTextNode(before),
      this.gap,
      document.createTextNode(after),
    );
  }

  private renderAnswers(): void {
    const presented = this.presented;
    if (!presented) return;
    this.buttons = [];
    this.input = null;

    if (this.mode === 'typed') {
      const input = el('input', {
        type: 'text',
        class: 'typed form-control form-control-lg',
        autocomplete: 'off',
        autocapitalize: 'off',
        spellcheck: 'false',
        'aria-label': 'Escreva a forma verbal que completa a frase',
        placeholder: 'escreva a forma verbal',
      });
      input.addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          this.confirm();
        }
      });
      this.input = input;
      this.answers.replaceChildren(input);
      return;
    }

    const list = presented.options.map((option, index) => {
      const button = el(
        'button',
        {
          type: 'button',
          class:
            'option list-group-item list-group-item-action d-flex align-items-center gap-3',
          'aria-pressed': 'false',
          // O texto do botao comeca com o numero do atalho; guardar a
          // alternativa crua e o que permite compara-la sem ambiguidade.
          'data-option': option,
        },
        [el('span', { class: 'option__key', text: String(index + 1) }), option],
      );
      button.addEventListener('click', () => this.select(index));
      return button;
    });
    this.buttons = list;
    this.answers.replaceChildren(...list);
  }

  private select(index: number): void {
    if (this.answered) return;
    this.selected = index;
    this.buttons.forEach((button, i) => {
      button.setAttribute('aria-pressed', String(i === index));
      button.classList.toggle('option--selected', i === index);
    });
    this.buttons[index]?.focus();
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Esc nao fecha: a pergunta e obrigatoria.
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
    if (event.key === 'Tab') {
      this.trapFocus(event);
      return;
    }
    if (this.answered) return;

    if (this.mode === 'choice') {
      const index = KEY_TO_INDEX[event.code];
      if (index !== undefined && index < this.buttons.length) {
        event.preventDefault();
        this.select(index);
        return;
      }
      if (event.key === 'ArrowDown' || event.key === 'ArrowRight') {
        event.preventDefault();
        this.select((this.selected + 1 + this.buttons.length) % this.buttons.length);
        return;
      }
      if (event.key === 'ArrowUp' || event.key === 'ArrowLeft') {
        event.preventDefault();
        const base = this.selected < 0 ? 0 : this.selected;
        this.select((base - 1 + this.buttons.length) % this.buttons.length);
        return;
      }
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      this.confirm();
      return;
    }
    // Espaco e setas nao podem vazar para o controle da cobra.
    if (event.key === ' ') event.preventDefault();
  }

  private trapFocus(event: KeyboardEvent): void {
    const focusable = focusableIn(this.dialog);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  private confirm(): void {
    if (this.answered || !this.presented) return;
    const chosen =
      this.mode === 'typed'
        ? (this.input?.value ?? '').trim()
        : (this.presented.options[this.selected] ?? '');
    if (chosen === '') return;

    const question = this.presented.question;
    const correct =
      this.mode === 'typed'
        ? isTypedAnswerCorrect(question, chosen)
        : isChoiceCorrect(question, chosen);
    this.resolve(chosen, correct);
  }

  private resolve(chosen: string | null, correct: boolean): void {
    if (this.answered || !this.presented) return;
    this.answered = true;
    this.stopTimers();
    this.submit.disabled = true;
    this.buttons.forEach((button) => (button.disabled = true));
    if (this.input) this.input.disabled = true;

    const question = this.presented.question;
    const answer = correctAnswer(question);
    this.showFeedback(chosen, correct, answer, question.explanation);
    this.callbacks.onAnswered({
      chosen,
      correct,
      elapsedMs: Math.round(performance.now() - this.startedAt),
    });

    this.timeout = window.setTimeout(() => {
      this.backdrop.hidden = true;
      this.callbacks.onDismissed();
    }, CONFIG.FEEDBACK_MS);
  }

  /** Assinatura visual: a forma correta se encaixa na lacuna. */
  private showFeedback(
    chosen: string | null,
    correct: boolean,
    answer: string,
    explanation: string,
  ): void {
    this.gap.textContent = answer;
    this.gap.classList.add('gap--filled', correct ? 'gap--ok' : 'gap--corrected');

    // Comparacao exata, nunca por sufixo: com a certa "started" e o distrator
    // "had started", o sufixo pintaria os dois de verde.
    const certa = normalize(answer);
    const marcada = chosen === null ? null : normalize(chosen);
    this.buttons.forEach((button) => {
      const texto = normalize(button.dataset.option ?? '');
      if (texto === certa) button.classList.add('option--ok');
      else if (marcada !== null && texto === marcada) {
        button.classList.add('option--err');
      }
    });

    const penalty = CONFIG.WRONG_PENALTY_SEGMENTS;
    const headline = correct
      ? 'Certo.'
      : chosen === null
        ? `Tempo esgotado. A cobra perdeu ${penalty} segmentos.`
        : `Errado. A cobra perdeu ${penalty} segmentos.`;

    const children: Array<Node | string> = [
      el('strong', { class: 'feedback__headline', text: headline }),
    ];
    if (!correct && chosen !== null) {
      children.push(
        el('p', { class: 'feedback__chosen' }, [
          'Voce marcou ',
          el('s', { text: chosen }),
          `. A forma correta e ${answer}.`,
        ]),
      );
    }
    children.push(el('p', { class: 'feedback__why', text: explanation }));

    this.feedback.className = `feedback feedback--${correct ? 'ok' : 'err'}`;
    this.feedback.replaceChildren(...children);
  }

  private tick(): void {
    const elapsed = performance.now() - this.startedAt;
    const remaining = Math.max(0, CONFIG.QUESTION_TIME_MS - elapsed);
    const ratio = remaining / CONFIG.QUESTION_TIME_MS;
    this.timerBar.style.width = `${(ratio * 100).toFixed(2)}%`;
    this.timerBar.dataset.low = String(ratio < 0.25);
    this.timerText.textContent = `${Math.ceil(remaining / 1000)}s`;

    if (remaining <= 0) {
      this.resolve(null, false);
      return;
    }
    this.frame = window.requestAnimationFrame(() => this.tick());
  }

  private stopTimers(): void {
    if (this.frame !== null) window.cancelAnimationFrame(this.frame);
    if (this.timeout !== null) window.clearTimeout(this.timeout);
    this.frame = null;
    this.timeout = null;
  }
}
