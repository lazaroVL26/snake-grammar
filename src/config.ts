/**
 * Todas as constantes ajustaveis do jogo. Nenhum numero magico deve viver
 * fora deste arquivo.
 */
export const CONFIG = {
  /** Colunas da grade logica. */
  GRID_COLS: 20,
  /** Linhas da grade logica. */
  GRID_ROWS: 20,
  /** Tamanho da celula em pixels logicos (canvas 480x480). */
  CELL_SIZE: 24,
  /** Segmentos da cobra no inicio da partida. */
  INITIAL_LENGTH: 3,
  /** Abaixo disso a partida acaba por encolhimento. */
  MIN_LENGTH: 3,
  /** Intervalo inicial entre passos da cobra. */
  INITIAL_TICK_MS: 150,
  /** Quanto o intervalo diminui a cada acerto. */
  TICK_DECREMENT_MS: 5,
  /** Piso do intervalo entre passos. */
  MIN_TICK_MS: 80,
  /** Tempo para responder cada questao. */
  QUESTION_TIME_MS: 20_000,
  /** Duracao da tela de feedback depois de responder. */
  FEEDBACK_MS: 2_200,
  /** Duracao de cada numero da contagem regressiva de retomada. */
  RESUME_COUNTDOWN_MS: 600,
  /** Pontos por resposta correta. */
  POINTS_PER_CORRECT: 10,
  /** Segmentos perdidos a cada erro (ou estouro de tempo). */
  WRONG_PENALTY_SEGMENTS: 2,
  /** A cada N acertos consecutivos vem o bonus de sequencia. */
  STREAK_BONUS_EVERY: 3,
  /** Pontos extras do bonus de sequencia. */
  STREAK_BONUS_POINTS: 5,
  /** Paredes solidas: bater na borda e game over. */
  WRAP_WALLS: false,
  /** Quantas viradas ficam enfileiradas aguardando o proximo tick. */
  DIRECTION_BUFFER: 2,
  /** Chave unica no localStorage. */
  STORAGE_KEY: 'snake-grammar:v1',
} as const;

/** Frutas 1..5 usam nivel 1, 6..12 usam nivel 2, dai em diante nivel 3. */
export const LEVEL_THRESHOLDS = {
  LEVEL_1_UNTIL: 5,
  LEVEL_2_UNTIL: 12,
} as const;

/** Janela (inclusiva) de posicoes a frente onde uma questao errada e repescada. */
export const REQUEUE_WINDOW = { MIN: 3, MAX: 6 } as const;
