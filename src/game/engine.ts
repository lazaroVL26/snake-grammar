/**
 * Loop de tempo fixo com acumulador. O agendador de quadros e injetado
 * (requestAnimationFrame vem de main.ts) para manter este modulo livre de DOM.
 */
export type FrameScheduler = (callback: (timeMs: number) => void) => number;
export type FrameCanceller = (handle: number) => void;

export interface EngineOptions {
  /** Intervalo atual entre passos, consultado a cada quadro. */
  tickMs: () => number;
  /** Um passo logico do jogo. */
  onTick: (now: number) => void;
  /** Desenho, chamado uma vez por quadro. */
  onRender: (now: number) => void;
  schedule: FrameScheduler;
  cancel: FrameCanceller;
  /** Teto de passos por quadro: evita travar apos a aba ficar em segundo plano. */
  maxStepsPerFrame?: number;
}

export class Engine {
  private handle: number | null = null;
  private accumulator = 0;
  private last: number | null = null;
  private readonly maxSteps: number;

  constructor(private readonly options: EngineOptions) {
    this.maxSteps = options.maxStepsPerFrame ?? 5;
  }

  start(): void {
    if (this.handle !== null) return;
    this.last = null;
    this.accumulator = 0;
    this.loop = this.loop.bind(this);
    this.handle = this.options.schedule(this.loop);
  }

  stop(): void {
    if (this.handle === null) return;
    this.options.cancel(this.handle);
    this.handle = null;
    this.last = null;
    this.accumulator = 0;
  }

  /** Zera o acumulador sem parar o loop (usado ao sair de pausa/modal). */
  resetClock(): void {
    this.last = null;
    this.accumulator = 0;
  }

  private loop(now: number): void {
    this.handle = this.options.schedule(this.loop);
    const previous = this.last ?? now;
    this.last = now;
    this.accumulator += now - previous;

    const tickMs = Math.max(1, this.options.tickMs());
    let steps = 0;
    while (this.accumulator >= tickMs && steps < this.maxSteps) {
      this.accumulator -= tickMs;
      steps += 1;
      this.options.onTick(now);
    }
    if (steps >= this.maxSteps) this.accumulator = 0;

    this.options.onRender(now);
  }
}
