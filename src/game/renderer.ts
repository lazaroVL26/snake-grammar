import { CONFIG } from '../config';
import type { GameState, Vec } from '../types';

/** Cores lidas dos tokens CSS: a paleta vive so em tokens.css. */
interface Palette {
  surface: string;
  grid: string;
  snake: string;
  snakeHead: string;
  fruit: string;
}

function readPalette(canvas: HTMLCanvasElement): Palette {
  const style = getComputedStyle(canvas);
  const read = (name: string, fallback: string): string =>
    style.getPropertyValue(name).trim() || fallback;
  return {
    surface: read('--surface', '#16263F'),
    grid: read('--grid', '#1D3355'),
    snake: read('--snake', '#F2C14E'),
    snakeHead: read('--snake-head', '#FFD97D'),
    fruit: read('--fruit', '#EE6C5D'),
  };
}

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private palette: Palette;
  private ratio = 1;

  constructor(private readonly canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D nao disponivel neste navegador.');
    this.ctx = ctx;
    this.palette = readPalette(canvas);
    this.resize();
  }

  /** Reajusta o buffer ao devicePixelRatio para o desenho nao borrar. */
  resize(): void {
    const width = CONFIG.GRID_COLS * CONFIG.CELL_SIZE;
    const height = CONFIG.GRID_ROWS * CONFIG.CELL_SIZE;
    this.ratio = Math.min(window.devicePixelRatio || 1, 3);
    this.canvas.width = Math.round(width * this.ratio);
    this.canvas.height = Math.round(height * this.ratio);
    this.palette = readPalette(this.canvas);
    this.ctx.setTransform(this.ratio, 0, 0, this.ratio, 0, 0);
  }

  draw(state: GameState, timeMs: number): void {
    const { ctx } = this;
    const width = CONFIG.GRID_COLS * CONFIG.CELL_SIZE;
    const height = CONFIG.GRID_ROWS * CONFIG.CELL_SIZE;

    ctx.fillStyle = this.palette.surface;
    ctx.fillRect(0, 0, width, height);
    this.drawGrid(width, height);

    if (state.phase !== 'question' && state.phase !== 'gameover') {
      this.drawFruit(state.fruit, timeMs);
    }
    this.drawSnake(state);
  }

  private drawGrid(width: number, height: number): void {
    const { ctx } = this;
    ctx.strokeStyle = this.palette.grid;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let x = 0; x <= CONFIG.GRID_COLS; x += 1) {
      const px = Math.round(x * CONFIG.CELL_SIZE) + 0.5;
      ctx.moveTo(px, 0);
      ctx.lineTo(px, height);
    }
    for (let y = 0; y <= CONFIG.GRID_ROWS; y += 1) {
      const py = Math.round(y * CONFIG.CELL_SIZE) + 0.5;
      ctx.moveTo(0, py);
      ctx.lineTo(width, py);
    }
    ctx.stroke();
  }

  private drawSnake(state: GameState): void {
    const { ctx } = this;
    const cell = CONFIG.CELL_SIZE;
    const segments = state.snake.segments;

    for (let i = segments.length - 1; i >= 0; i -= 1) {
      const segment = segments[i];
      if (!segment) continue;
      const isHead = i === 0;
      ctx.fillStyle = isHead ? this.palette.snakeHead : this.palette.snake;
      const inset = isHead ? 1.5 : 2.5;
      roundRect(
        ctx,
        segment.x * cell + inset,
        segment.y * cell + inset,
        cell - inset * 2,
        cell - inset * 2,
        isHead ? 7 : 5,
      );
      ctx.fill();
    }

    const eyes = segments[0];
    if (eyes) this.drawEyes(eyes, state);
  }

  private drawEyes(head: Vec, state: GameState): void {
    const { ctx } = this;
    const cell = CONFIG.CELL_SIZE;
    const cx = head.x * cell + cell / 2;
    const cy = head.y * cell + cell / 2;
    const offset = cell * 0.19;
    const along = cell * 0.2;
    const dir = state.snake.direction;
    const forward = { x: dir === 'right' ? 1 : dir === 'left' ? -1 : 0, y: dir === 'down' ? 1 : dir === 'up' ? -1 : 0 };
    const side = { x: forward.y, y: forward.x };

    ctx.fillStyle = '#0E1A2B';
    for (const sign of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(
        cx + forward.x * along + side.x * offset * sign,
        cy + forward.y * along + side.y * offset * sign,
        cell * 0.075,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  private drawFruit(fruit: Vec, timeMs: number): void {
    const { ctx } = this;
    const cell = CONFIG.CELL_SIZE;
    const pulse = 1 + Math.sin(timeMs / 260) * 0.06;
    const radius = (cell * 0.33) * pulse;
    const cx = fruit.x * cell + cell / 2;
    const cy = fruit.y * cell + cell / 2;

    ctx.fillStyle = this.palette.fruit;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();

    // Cabinho: dá leitura de "fruta" sem precisar de sprite.
    ctx.strokeStyle = this.palette.snake;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy - radius);
    ctx.lineTo(cx + cell * 0.12, cy - radius - cell * 0.14);
    ctx.stroke();
  }
}

function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}
