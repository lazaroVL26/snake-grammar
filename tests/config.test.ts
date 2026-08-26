import { describe, expect, it } from 'vitest';
import { CONFIG } from '../src/config';

describe('config', () => {
  it('mantem paredes solidas por padrao', () => {
    expect(CONFIG.WRAP_WALLS).toBe(false);
  });

  it('tem piso de velocidade menor que o tick inicial', () => {
    expect(CONFIG.MIN_TICK_MS).toBeLessThan(CONFIG.INITIAL_TICK_MS);
  });
});
