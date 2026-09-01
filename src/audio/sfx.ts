/**
 * Efeitos sonoros sintetizados na hora com Web Audio.
 *
 * Nada de arquivo de audio: o jogo precisa rodar offline e sem dependencia,
 * e onda quadrada curta e exatamente o timbre de fliperama que a direcao de
 * arte pede (CLAUDE.md 9.1).
 */

interface Nota {
  /** Frequencia em hertz. */
  hz: number;
  /** Atraso em relacao ao inicio do efeito, em segundos. */
  em: number;
  /** Duracao em segundos. */
  dura: number;
}

/** Duas notas subindo: o "acertou". */
const ACERTO: Nota[] = [
  { hz: 660, em: 0, dura: 0.09 },
  { hz: 990, em: 0.08, dura: 0.14 },
];

/** Duas notas descendo e mais graves: o "errou", sem ser agressivo. */
const ERRO: Nota[] = [
  { hz: 200, em: 0, dura: 0.11 },
  { hz: 130, em: 0.1, dura: 0.18 },
];

const VOLUME = 0.14;

export class Sfx {
  private context: AudioContext | null = null;
  private ligado: boolean;

  constructor(ligado = true) {
    this.ligado = ligado;
  }

  get enabled(): boolean {
    return this.ligado;
  }

  setEnabled(on: boolean): void {
    this.ligado = on;
  }

  correct(): void {
    this.play(ACERTO, 'square');
  }

  wrong(): void {
    this.play(ERRO, 'sawtooth');
  }

  /** Solta os recursos de audio. Usado nos testes. */
  dispose(): void {
    void this.context?.close();
    this.context = null;
  }

  /**
   * O AudioContext so nasce no primeiro som, e nunca antes de um clique ou
   * tecla: navegador bloqueia audio criado sem gesto do usuario.
   */
  private ensureContext(): AudioContext | null {
    if (!this.ligado) return null;
    if (this.context) {
      if (this.context.state === 'suspended') void this.context.resume();
      return this.context;
    }
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.context = new Ctor();
      return this.context;
    } catch {
      // Navegador sem audio disponivel: o jogo segue em silencio.
      return null;
    }
  }

  private play(notas: readonly Nota[], forma: OscillatorType): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const agora = ctx.currentTime;

    for (const nota of notas) {
      const osc = ctx.createOscillator();
      const ganho = ctx.createGain();
      osc.type = forma;
      osc.frequency.value = nota.hz;

      const inicio = agora + nota.em;
      const fim = inicio + nota.dura;
      // Envelope curto: sem o fade, cada nota estala no comeco e no fim.
      ganho.gain.setValueAtTime(0, inicio);
      ganho.gain.linearRampToValueAtTime(VOLUME, inicio + 0.01);
      ganho.gain.exponentialRampToValueAtTime(0.0001, fim);

      osc.connect(ganho).connect(ctx.destination);
      osc.start(inicio);
      osc.stop(fim + 0.02);
    }
  }
}

/** Botao de ligar e desligar o som, no cabecalho. */
export function createSoundButton(
  sfx: Sfx,
  onChange: (on: boolean) => void,
): HTMLButtonElement {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'sound-toggle btn btn-outline-secondary btn-sm';
  button.title = 'Som de acerto e erro';

  const sync = (): void => {
    button.textContent = sfx.enabled ? 'Som ligado' : 'Som desligado';
    button.setAttribute('aria-pressed', String(sfx.enabled));
  };

  button.addEventListener('click', () => {
    sfx.setEnabled(!sfx.enabled);
    sync();
    onChange(sfx.enabled);
    // Toca ao ligar: o aluno confere o volume sem precisar errar de proposito.
    if (sfx.enabled) sfx.correct();
  });

  sync();
  return button;
}
