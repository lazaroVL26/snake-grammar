// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Sfx, createSoundButton } from '../src/audio/sfx';

interface OscFalso {
  type: string;
  frequency: { value: number };
  inicio: number;
  fim: number;
}

interface Espiao {
  criados: OscFalso[];
  contextos: number;
  estado: string;
  retomadas: number;
}

/** O jsdom nao tem Web Audio: aqui vai uma de mentira que registra o que tocou. */
function instalarAudio(
  options: { indisponivel?: boolean; quebrado?: boolean } = {},
): Espiao {
  const espiao: Espiao = { criados: [], contextos: 0, estado: 'running', retomadas: 0 };

  if (options.indisponivel) {
    vi.stubGlobal('AudioContext', undefined);
    return espiao;
  }

  class ContextoFalso {
    currentTime = 0;
    destination = {};
    get state(): string {
      return espiao.estado;
    }
    constructor() {
      espiao.contextos += 1;
      if (options.quebrado) throw new Error('audio indisponivel');
    }
    resume(): Promise<void> {
      espiao.retomadas += 1;
      espiao.estado = 'running';
      return Promise.resolve();
    }
    close(): Promise<void> {
      return Promise.resolve();
    }
    createOscillator(): unknown {
      const osc: OscFalso = { type: '', frequency: { value: 0 }, inicio: -1, fim: -1 };
      espiao.criados.push(osc);
      return {
        set type(v: string) {
          osc.type = v;
        },
        get type(): string {
          return osc.type;
        },
        frequency: osc.frequency,
        connect: (destino: unknown) => destino,
        start: (t: number) => (osc.inicio = t),
        stop: (t: number) => (osc.fim = t),
      };
    }
    createGain(): unknown {
      return {
        gain: {
          setValueAtTime: () => undefined,
          linearRampToValueAtTime: () => undefined,
          exponentialRampToValueAtTime: () => undefined,
        },
        connect: (destino: unknown) => destino,
      };
    }
  }

  vi.stubGlobal('AudioContext', ContextoFalso);
  return espiao;
}

beforeEach(() => {
  document.body.replaceChildren();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('sfx — acerto e erro soam diferente', () => {
  it('o acerto sobe de tom', () => {
    const espiao = instalarAudio();
    new Sfx(true).correct();
    const hz = espiao.criados.map((o) => o.frequency.value);
    expect(hz.length).toBe(2);
    expect(hz[1]).toBeGreaterThan(hz[0] as number);
  });

  it('o erro desce de tom e e mais grave que o acerto', () => {
    const espiao = instalarAudio();
    const sfx = new Sfx(true);
    sfx.correct();
    const acerto = espiao.criados.map((o) => o.frequency.value);
    espiao.criados.length = 0;

    sfx.wrong();
    const erro = espiao.criados.map((o) => o.frequency.value);
    expect(erro.length).toBe(2);
    expect(erro[1]).toBeLessThan(erro[0] as number);
    expect(Math.max(...erro)).toBeLessThan(Math.min(...acerto));
  });

  it('as notas sao curtas e a segunda entra depois da primeira', () => {
    const espiao = instalarAudio();
    new Sfx(true).correct();
    const [a, b] = espiao.criados as [OscFalso, OscFalso];
    expect(b.inicio).toBeGreaterThan(a.inicio);
    // Nada de som arrastado por cima do feedback.
    expect(b.fim).toBeLessThan(0.5);
  });

  it('usa timbre de fliperama, nao senoide', () => {
    const espiao = instalarAudio();
    const sfx = new Sfx(true);
    sfx.correct();
    expect(espiao.criados[0]?.type).toBe('square');
    espiao.criados.length = 0;
    sfx.wrong();
    expect(espiao.criados[0]?.type).toBe('sawtooth');
  });
});

describe('sfx — desligado', () => {
  it('desligado nao toca nada nem cria contexto de audio', () => {
    const espiao = instalarAudio();
    const sfx = new Sfx(false);
    sfx.correct();
    sfx.wrong();
    expect(espiao.criados.length).toBe(0);
    expect(espiao.contextos).toBe(0);
  });

  it('religar volta a tocar', () => {
    const espiao = instalarAudio();
    const sfx = new Sfx(false);
    sfx.correct();
    sfx.setEnabled(true);
    sfx.correct();
    expect(espiao.criados.length).toBe(2);
  });
});

describe('sfx — robustez', () => {
  it('reaproveita um unico contexto de audio', () => {
    const espiao = instalarAudio();
    const sfx = new Sfx(true);
    sfx.correct();
    sfx.wrong();
    sfx.correct();
    expect(espiao.contextos).toBe(1);
  });

  it('retoma o contexto suspenso pelo navegador', () => {
    const espiao = instalarAudio();
    const sfx = new Sfx(true);
    sfx.correct();
    espiao.estado = 'suspended';
    sfx.correct();
    expect(espiao.retomadas).toBe(1);
  });

  it('navegador sem Web Audio nao quebra o jogo', () => {
    instalarAudio({ indisponivel: true });
    const sfx = new Sfx(true);
    expect(() => {
      sfx.correct();
      sfx.wrong();
    }).not.toThrow();
  });

  it('contexto que falha ao nascer nao quebra o jogo', () => {
    instalarAudio({ quebrado: true });
    const sfx = new Sfx(true);
    expect(() => sfx.correct()).not.toThrow();
  });
});

describe('sfx — botao de som', () => {
  it('comeca refletindo o estado e alterna ao clicar', () => {
    instalarAudio();
    const mudancas: boolean[] = [];
    const sfx = new Sfx(true);
    const button = createSoundButton(sfx, (on) => mudancas.push(on));
    document.body.append(button);

    expect(button.textContent).toBe('Som ligado');
    expect(button.getAttribute('aria-pressed')).toBe('true');

    button.click();
    expect(button.textContent).toBe('Som desligado');
    expect(button.getAttribute('aria-pressed')).toBe('false');
    expect(sfx.enabled).toBe(false);
    expect(mudancas).toEqual([false]);

    button.click();
    expect(sfx.enabled).toBe(true);
    expect(mudancas).toEqual([false, true]);
  });

  it('ao religar, toca uma vez para o aluno conferir o volume', () => {
    const espiao = instalarAudio();
    const sfx = new Sfx(false);
    const button = createSoundButton(sfx, () => undefined);
    button.click();
    expect(espiao.criados.length).toBeGreaterThan(0);
  });

  it('ao desligar nao toca nada', () => {
    const espiao = instalarAudio();
    const sfx = new Sfx(true);
    const button = createSoundButton(sfx, () => undefined);
    button.click();
    expect(espiao.criados.length).toBe(0);
  });
});
