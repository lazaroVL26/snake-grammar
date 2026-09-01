# CLAUDE.md — Snake Grammar

Este arquivo é a **fonte da verdade** do projeto. Sempre que houver conflito entre uma
ideia sua e este documento, este documento vence. Se algo estiver genuinamente ambíguo,
escolha a opção mais simples, implemente e registre a decisão em `DECISIONS.md`.

---

## 1. Contexto e objetivo

Jogo web educativo usado como atividade de sala de aula em uma **aula de inglês**
(ensino superior / técnico, alunos brasileiros, nível A2–B1). O jogo é o clássico
**Snake**: a cobra se move em uma grade, come frutas e cresce.

O diferencial: **toda vez que a cobra come uma fruta, o jogo congela e abre um modal
com uma frase em inglês com lacuna** (gap-fill) sobre **tempos verbais do inglês**. Na
tela inicial o aluno escolhe o conteúdo da rodada: Simple Past × Past Perfect (o conjunto
original), Presente, Passado, Futuro ou todos misturados.

- Resposta **certa** → +1 ponto e a cobra cresce 1 segmento.
- Resposta **errada** → a cobra **perde 1 segmento** de comprimento (e não pontua).
- Se a cobra ficar com menos de 3 segmentos → game over.

O objetivo pedagógico é **forçar a decisão gramatical sob leve pressão de tempo**,
com feedback imediato e explicação em português depois de cada resposta.

Público: alunos brasileiros. **Interface em português do Brasil, conteúdo do exercício
em inglês.** Nunca traduza as frases do exercício.

---

## 2. Stack e restrições técnicas

- **TypeScript** em modo `strict` (obrigatório, sem `any` implícito nem explícito).
- **Vite** como bundler/dev server.
- **Vanilla TS + Canvas 2D** para o jogo. **Não use React, Vue, Svelte, Phaser ou
  qualquer game engine.** O tabuleiro é desenhado no `<canvas>`; HUD, modais e overlays
  são DOM comum.
- **CSS puro** com custom properties (`:root`). Sem Tailwind, sem CSS-in-JS, sem
  frameworks de UI.
- **Vitest** para testes unitários da lógica pura.
- **ESLint + Prettier**.
- **Zero dependências de runtime.** Tudo que vai para o bundle final deve ser código
  próprio. Dependências apenas em `devDependencies`.
- Persistência apenas em `localStorage`. **Sem backend, sem banco de dados, sem API
  externa, sem chamada de rede em runtime.**
- Deve rodar 100% offline depois do build (`dist/` servido como arquivos estáticos).
- Alvo: navegadores modernos (Chrome/Edge/Firefox/Safari atuais). Sem polyfills legados.

---

## 3. Comandos

```bash
npm install
npm run dev        # servidor de desenvolvimento
npm run build      # type-check + build de produção em dist/
npm run preview    # serve o build
npm run test       # vitest run
npm run test:watch
npm run lint       # eslint --max-warnings=0
npm run format     # prettier --write
```

`npm run build` deve rodar `tsc --noEmit && vite build`. Se o type-check falhar, o build
falha — não contorne isso.

---

## 4. Estrutura de pastas

```
snake-grammar/
├─ index.html
├─ package.json
├─ tsconfig.json
├─ vite.config.ts
├─ vitest.config.ts
├─ .eslintrc.cjs
├─ .prettierrc
├─ README.md
├─ DECISIONS.md
├─ CLAUDE.md
├─ content/
│  └─ questions.seed.json      # banco de questões (fornecido, ver §8)
└─ src/
   ├─ main.ts                  # bootstrap: monta DOM, instancia Game, liga input
   ├─ types.ts                 # todos os tipos compartilhados
   ├─ config.ts                # TODAS as constantes ajustáveis (§6)
   ├─ game/
   │  ├─ engine.ts             # loop de tempo fixo (requestAnimationFrame + acumulador)
   │  ├─ state.ts              # máquina de estados + reducers puros
   │  ├─ snake.ts              # mover, crescer, encolher, virar
   │  ├─ board.ts              # grade, posição livre aleatória, spawn de fruta
   │  ├─ collision.ts          # parede e autocolisão
   │  └─ renderer.ts           # desenho no canvas (única parte que toca no contexto 2D)
   ├─ quiz/
   │  ├─ questions.ts          # import + validação do JSON, tipagem
   │  ├─ selector.ts           # escolha sem repetição + repescagem de erros
   │  └─ answer.ts             # normalização e verificação de resposta digitada
   ├─ ui/
   │  ├─ hud.ts                # pontos, comprimento, acertos/erros, recorde
   │  ├─ questionModal.ts      # modal da pergunta + feedback
   │  ├─ overlays.ts           # tela inicial, pausa, game over, relatório final
   │  └─ dom.ts               # helpers mínimos de criação de elemento
   ├─ input/
   │  ├─ keyboard.ts
   │  └─ touch.ts              # swipe + D-pad na tela em telas pequenas
   ├─ storage/
   │  ├─ persistence.ts        # recorde, estatísticas e apelido em localStorage
   │  └─ scoreboard.ts         # ranking do dia, com reset diário
   └─ styles/
      ├─ tokens.css
      └─ app.css
```

**Regra de ouro da arquitetura:** `src/game/` e `src/quiz/` são **lógica pura e
testável** — não podem importar nada de `src/ui/`, `src/input/` nem tocar em `document`,
`window` ou `canvas`. Toda I/O acontece em `main.ts`, `ui/`, `input/`, `storage/` e
`renderer.ts`.

---

## 5. Regras do jogo (fonte da verdade)

### 5.1 Tabuleiro

- Grade de **20 × 20** células. Célula lógica de 24px → canvas 480×480 (CSS escala
  responsivamente mantendo proporção; use `devicePixelRatio` para não borrar).
- A cobra começa com **3 segmentos**, no centro, andando para a **direita**.
- 1 fruta na tela por vez, em célula livre aleatória (nunca em cima da cobra).

### 5.2 Movimento

- Loop de **tempo fixo**: a cobra dá 1 passo a cada `tickMs`.
- `tickMs` inicial: **150ms**. A cada resposta correta diminui **5ms**, com piso de
  **80ms**. Respostas erradas **não** alteram a velocidade.
- Entrada de direção é **enfileirada** (buffer de até 2 direções) e aplicada 1 por tick.
  Isso evita o bug clássico de virar 180° em um único tick fazendo duas teclas rápidas.
- **Proibido inverter 180°** em relação à direção do tick atual.
- Bater na parede → game over. Bater no próprio corpo → game over.
  (`WRAP_WALLS` existe em `config.ts` como `false`; não mude o padrão.)

### 5.3 Ciclo da pergunta

1. Cabeça entra na célula da fruta.
2. Estado muda para `'question'`. **O loop congela imediatamente** — a cobra não anda,
   o cronômetro do jogo pausa, o buffer de direções é limpo.
3. Abre o modal com a questão, foco no primeiro elemento interativo.
4. Cronômetro da questão: **20 segundos** (`QUESTION_TIME_MS`), com barra de progresso.
   Estourar o tempo conta como **erro**.
5. Resposta enviada → mostra feedback por **2200ms** (`FEEDBACK_MS`): certo/errado,
   a frase completa correta e a explicação em português.
6. Fecha o modal, nova fruta aparece, estado volta para `'running'` com uma contagem
   regressiva curta de 3, 2, 1 na tela (`RESUME_COUNTDOWN_MS = 600` por número) para o
   aluno se reposicionar. As teclas de direção ficam ativas durante a contagem, mas a
   cobra só volta a andar no fim.

### 5.4 Pontuação e penalidade

- **Acerto:** `score += 10`. Comprimento **+1**. `correctCount += 1`. `streak += 1`.
  Bônus de sequência: a cada 3 acertos consecutivos, `score += 5` extra.
- **Erro:** `score` não muda (nunca fica negativo). Comprimento
  **−`WRONG_PENALTY_SEGMENTS`** (hoje **2**; remove os últimos segmentos da cauda).
  `wrongCount += 1`. `streak = 0`. A questão errada volta para o final da fila para ser
  repescada mais tarde (§7.3).
- **Game over por encolhimento:** se após a penalidade o comprimento ficar **< 3**, o
  jogo termina com a mensagem "A cobra ficou curta demais". Não deixe o comprimento
  chegar a 0 nem gerar índice negativo.
- Recorde (`bestScore`), estatísticas e apelido ficam em `localStorage` na chave
  `snake-grammar:v1`. O ranking do dia fica na chave separada
  `snake-grammar:scores:v1` (§5.7).

### 5.5 Fim de jogo — relatório

A tela de game over é parte do valor pedagógico. Deve mostrar:

- Pontuação, recorde, comprimento final, tempo total.
- Acertos × erros e **precisão em %**.
- **Desempenho separado por tempo verbal**: quantos acertos/erros em `simple-past`,
  `past-perfect` e `contrast`.
- Lista das **frases erradas** com a resposta correta e a explicação (é o material de
  revisão que o professor vai usar depois da partida).
- Botões: "Jogar de novo" e "Copiar relatório" (copia um resumo em texto para a área de
  transferência, para o aluno colar no caderno/Moodle).

### 5.7 Apelido e ranking do dia

Antes de começar, o aluno escreve um apelido; sem ele a partida não inicia. O apelido é
lembrado entre partidas.

Toda partida terminada entra no ranking do dia, com apelido, pontuação, precisão e
conteúdo. O ranking fica numa **coluna própria ao lado do tabuleiro** (`aside.rank-side`),
visível a partida inteira, com a partida recém-jogada destacada. A tela de fim de jogo não
repete a lista: mostra só a colocação.

**O ranking zera a cada dia.** Cada entrada guarda o dia local em que foi jogada, e a
leitura descarta o que não é de hoje — sem tarefa agendada. Guarda no máximo
`SCOREBOARD_SIZE` partidas, ordenadas por pontuação; empate favorece quem jogou antes.

Como não há servidor (§2), o ranking é por navegador. O botão "Copiar ranking" existe para
o professor juntar as máquinas num documento só.

### 5.6 Máquina de estados

`'idle' | 'countdown' | 'running' | 'paused' | 'question' | 'feedback' | 'gameover'`

Transições válidas — implemente e teste isso explicitamente:

```
idle      → countdown        (Enter / botão Começar)
countdown → running          (fim da contagem)
running   → paused           (Espaço ou Esc ou perda de foco da janela)
paused    → countdown        (Espaço ou Esc)
running   → question         (comeu fruta)
question  → feedback         (respondeu ou estourou o tempo)
feedback  → countdown        (fim do feedback, se ainda vivo)
feedback  → gameover         (comprimento < 3)
running   → gameover         (colisão)
gameover  → idle             (Jogar de novo)
```

Qualquer outra transição deve ser ignorada, não lançar erro.

---

## 6. `config.ts` — constantes

Todas as constantes numéricas ficam **em um único arquivo exportado**, tipadas e
comentadas. Nada de números mágicos espalhados pelo código.

```ts
export const CONFIG = {
  GRID_COLS: 20,
  GRID_ROWS: 20,
  CELL_SIZE: 24,
  INITIAL_LENGTH: 3,
  MIN_LENGTH: 3,
  INITIAL_TICK_MS: 150,
  TICK_DECREMENT_MS: 5,
  MIN_TICK_MS: 80,
  QUESTION_TIME_MS: 20_000,
  FEEDBACK_MS: 2_200,
  RESUME_COUNTDOWN_MS: 600,
  POINTS_PER_CORRECT: 10,
  WRONG_PENALTY_SEGMENTS: 2,
  STREAK_BONUS_EVERY: 3,
  STREAK_BONUS_POINTS: 5,
  WRAP_WALLS: false,
  DIRECTION_BUFFER: 2,
  STORAGE_KEY: 'snake-grammar:v1',
  SCORE_STORAGE_KEY: 'snake-grammar:scores:v1',
  SCOREBOARD_SIZE: 20,
  SCOREBOARD_VISIBLE: 5,
  NICK_MAX_LENGTH: 16,
} as const;
```

---

## 7. Modelo de dados

### 7.1 Tipos principais (`src/types.ts`)

```ts
export type Vec = { x: number; y: number };
export type Direction = 'up' | 'down' | 'left' | 'right';
export type Focus =
  | 'simple-past'
  | 'past-continuous'
  | 'past-perfect'
  | 'past-perfect-continuous'
  | 'contrast'
  | 'present-simple'
  | 'present-continuous'
  | 'present-perfect'
  | 'present-perfect-continuous'
  | 'future-will'
  | 'future-going-to'
  | 'future-continuous'
  | 'future-perfect';
export type TopicId = 'all' | 'present' | 'past' | 'future' | 'past-contrast';
export type AnswerMode = 'choice' | 'typed';
export type GamePhase =
  'idle' | 'countdown' | 'running' | 'paused' | 'question' | 'feedback' | 'gameover';

export interface Question {
  id: string;
  level: 1 | 2 | 3;
  focus: Focus;
  sentence: string; // contém exatamente uma lacuna marcada com "___"
  verbHint: string; // verbo no infinitivo mostrado entre parênteses
  options: string[]; // 4 alternativas
  answerIndex: number; // índice da correta em options
  accepted: string[]; // formas aceitas no modo digitado, já normalizadas
  explanation: string; // em português do Brasil
}

export interface AttemptLog {
  questionId: string;
  focus: Focus;
  correct: boolean;
  chosen: string | null; // null = estourou o tempo
  elapsedMs: number;
}
```

### 7.2 Formato do banco de questões

`content/questions.seed.json` já existe e **não deve ser reescrito nem "melhorado"** —
apenas validado e, se necessário, ampliado com novas entradas no mesmo formato.
Ele é um array de objetos `Question`. A lacuna é sempre a string `___`.

Na inicialização, valide o JSON e **falhe alto e claro** (erro no console + tela de erro
legível) se: houver `id` duplicado, `answerIndex` fora do intervalo, `options.length !== 4`,
frase sem `___`, ou `accepted` que não contenha a alternativa correta normalizada.

### 7.3 Seleção de questões (`quiz/selector.ts`)

- Embaralhe o banco no início da partida (Fisher–Yates com PRNG **injetável** — o teste
  precisa de determinismo; use um seed).
- Percorra sem repetir. Só repita quando o banco acabar.
- **Repescagem:** questão errada volta para a fila numa posição entre 3 e 6 à frente.
- Dificuldade progressiva: as 5 primeiras frutas puxam `level: 1`; das 6 à 12, `level: 2`;
  daí em diante, `level: 3`. Se o nível acabar, cai para o nível mais próximo disponível.
- A ordem das `options` é embaralhada na exibição (o índice correto é recalculado).

---

### 7.4 Conteúdos do menu (`quiz/topics.ts`)

A tela inicial oferece cinco conteúdos. Cada um é um conjunto de `Focus`; `all` aceita o
banco inteiro. O padrão é `past-contrast`, o conteúdo original.

| `TopicId`       | Rótulo                     | Tempos incluídos                                            |
| --------------- | -------------------------- | ----------------------------------------------------------- |
| `past-contrast` | Simple Past x Past Perfect | `simple-past`, `past-perfect`, `contrast`                   |
| `present`       | Presente                   | simple, continuous, perfect, perfect continuous             |
| `past`          | Passado                    | simple, continuous, perfect, perfect continuous, `contrast` |
| `future`        | Futuro                     | will, going to, continuous, perfect                         |
| `all`           | Todos os tempos            | banco inteiro                                               |

Todo conteúdo precisa ter **pelo menos 12 questões e 4 por nível** — existe teste que
falha se um conteúdo do menu ficar magro demais.

---

## 8. Conteúdo pedagógico — regras inegociáveis

O conteúdo são os **tempos verbais do inglês**, agrupados em conteúdos escolhíveis
(§7.4). Se você criar questões novas:

1. **A alternativa correta precisa ser a única gramaticalmente possível no contexto.**
   Nunca coloque como distrator uma forma que também estaria correta. Exemplo do erro:
   "After they ___ dinner, they went out" aceita tanto `had` quanto `had had` — frase
   proibida.
2. Use gatilhos inequívocos para Past Perfect: `by the time`, `by 2018`, `already`,
   `never ... before`, discurso indireto, ou uma causa anterior explícita
   ("She didn't recognize him because they **hadn't met** for ten years").
3. Use marcadores claros para Simple Past: `yesterday`, `last night`, `in 2019`,
   `two weeks ago`, `at 9 a.m.`.
4. Explicação sempre em **português**, em 1 ou 2 frases, dizendo **por que** aquele tempo
   verbal é o certo ali — não apenas repetindo a regra genérica.
5. Distratores devem ser plausíveis: present perfect (`has finished`), presente simples
   (`finishes`), past continuous (`was finishing`), forma errada do particípio.
6. Vocabulário do nível A2–B1. Frases curtas, contexto cotidiano.
7. Sem conteúdo sensível, político ou que dependa de referência cultural específica.

---

## 9. UI, identidade visual e acessibilidade

### 9.1 Direção de arte

Nada de "neon verde em fundo preto" — o visual é **caderno de idiomas encontrando
fliperama**: fundo azul-noite, grade como papel pautado, e a cobra em amarelo de
marca-texto.

Tokens (defina em `styles/tokens.css`, use **só** estes):

```css
--bg: #0e1a2b; /* fundo da página */
--surface: #16263f; /* cartões, modal, HUD */
--grid: #1d3355; /* linhas da grade no canvas */
--snake: #f2c14e; /* corpo da cobra (marca-texto) */
--snake-head: #ffd97d;
--fruit: #ee6c5d; /* fruta */
--ok: #5fd3a0; /* acerto */
--err: #ee6c5d; /* erro */
--text: #eae7e1;
--muted: #9aaec8;
```

Tipografia (3 papéis, carregadas do Google Fonts no `index.html` com `display=swap`):

- Display / títulos: **Bricolage Grotesque**, peso 700, tracking apertado.
- Corpo / UI: **Inter**.
- **Frase do exercício: IBM Plex Mono** — a frase em inglês aparece sempre em
  monoespaçada, com a lacuna renderizada como um sublinhado que pulsa como cursor de
  caderno. Essa é a assinatura visual do projeto.

Momento de assinatura: ao acertar, o verbo escolhido **se encaixa na lacuna** (transição
curta de 200ms, escala + cor `--ok`) e só então o modal fecha e a cauda cresce. Ao errar,
a lacuna é preenchida com a forma correta em `--ok` e a escolha do aluno é riscada em
`--err`. Uma animação bem feita, não cinco.

Restrição: `prefers-reduced-motion: reduce` desliga todas as animações e transições —
o feedback vira troca de estado instantânea.

### 9.2 Layout

- Coluna do jogo centralizada, largura máxima ~640px. A partir de 960px de viewport,
  uma coluna lateral de 232px com o ranking do dia aparece à direita, grudada no topo
  (`position: sticky`); abaixo disso ela desce para o fim da página, depois do D-pad.
- HUD acima do canvas: pontos • comprimento • acertos/erros • recorde.
- Abaixo do canvas: uma linha discreta com os controles.
- Responsivo até 360px de largura: o canvas encolhe proporcionalmente e o D-pad de toque
  aparece abaixo dele.

### 9.3 Modal da pergunta

- `role="dialog"`, `aria-modal="true"`, foco preso dentro do modal (focus trap).
- **Esc não fecha** o modal — a pergunta é obrigatória. Esc dentro do modal não faz nada.
- Alternativas navegáveis por `Tab`/setas, selecionáveis pelas teclas **1–4**, confirmação
  com `Enter`.
- Modo digitado (`AnswerMode = 'typed'`, alternável na tela inicial): `<input>` com foco
  automático e `Enter` para enviar. Comparação **normalizada**: minúsculas, espaços
  colapsados, apóstrofos tipográficos convertidos, aceita contração
  (`had left` ≡ `'d left`). Sem tolerância a erro de digitação no verbo — isso é o que
  está sendo avaliado.
- Feedback anunciado em `aria-live="assertive"`.
- Nunca use `<form>` com submit padrão; use handlers de evento.

### 9.4 Acessibilidade e qualidade mínima

- Contraste AA em todo texto sobre `--bg` e `--surface`.
- Foco visível em todo elemento interativo (`:focus-visible` com outline de 2px).
- O jogo pausa sozinho ao perder o foco da janela (`blur`) e ao trocar de aba
  (`visibilitychange`).
- O canvas tem `aria-label` descritivo; o HUD é texto real no DOM, não desenho.

### 9.5 Escrita da interface (pt-BR)

- Frases curtas, voz ativa, sentence case. "Começar", "Continuar", "Jogar de novo".
- O erro explica o que aconteceu e o que fazer: "Tempo esgotado. A cobra perdeu 1
  segmento." — nunca "Ops! Algo deu errado".
- Nada de emoji na UI.

---

## 10. Estilo de código

- `strict: true`, `noUncheckedIndexedAccess: true`, `noImplicitOverride: true`.
- Sem `any`, sem `!` de non-null assertion (exceto em `main.ts` na busca inicial de
  elementos, com checagem explícita e erro claro se faltar).
- Funções puras onde der. Estado do jogo é atualizado por funções que **recebem estado e
  retornam novo estado** — sem mutação escondida em `renderer.ts`.
- Nomes em inglês no código; comentários e strings de UI em português.
- Comentário só quando explica **porquê**, não o quê.
- Arquivos com menos de ~200 linhas. Se passar disso, provavelmente há dois módulos ali.
- Sem `console.log` no código final (apenas `console.error` na validação do banco).

---

## 11. Testes obrigatórios (Vitest)

Cobertura mínima real, não teste decorativo. Estes casos precisam existir:

**snake.ts**

- move um passo em cada direção;
- crescer adiciona segmento sem perder a cauda no mesmo tick;
- encolher remove exatamente 1 segmento;
- inversão de 180° é ignorada;
- buffer de direção aplica no máximo 1 virada por tick.

**collision.ts**

- colisão com cada uma das 4 paredes;
- autocolisão real;
- não acusa colisão quando a cabeça ocupa a célula que a cauda acabou de liberar.

**board.ts**

- fruta nunca nasce em cima da cobra (teste com PRNG seedado e tabuleiro quase cheio).

**state.ts**

- acerto: +10 pontos, +1 comprimento, streak incrementa;
- bônus a cada 3 acertos consecutivos;
- erro: pontuação inalterada, −`WRONG_PENALTY_SEGMENTS` de comprimento, streak zera;
- erro com comprimento 3 → `gameover` com motivo `too-short`;
- transições inválidas da máquina de estados são ignoradas;
- estouro de tempo é tratado exatamente como erro, com `chosen: null`.

**selector.ts**

- não repete questão enquanto houver questões não usadas;
- questão errada reaparece dentro da janela de 3–6;
- progressão de nível respeita as faixas de fruta.

**answer.ts**

- normalização: maiúsculas, espaço duplo, apóstrofo curvo, contração `'d`;
- resposta errada por verbo diferente não é aceita.

**questions.seed.json**

- teste de integridade que roda sobre o arquivo real: ids únicos, 4 opções,
  `answerIndex` válido, `___` presente, `accepted` contém a correta normalizada.

---

## 12. Definition of Done

Só considere a tarefa concluída quando **todos** os itens abaixo forem verdadeiros:

- [ ] `npm run build` passa sem erro nem warning de TypeScript.
- [ ] `npm run lint` passa com `--max-warnings=0`.
- [ ] `npm run test` passa, com todos os casos da §11 implementados.
- [ ] Partida completa jogável: começar → comer → responder → acertar → crescer →
      errar → encolher → morrer por encolhimento → ver relatório → jogar de novo.
- [ ] Game over por parede e por autocolisão funcionam.
- [ ] Pausa por tecla e por troca de aba funcionam.
- [ ] Modo digitado e modo múltipla escolha funcionam.
- [ ] Recorde persiste depois de recarregar a página.
- [ ] Relatório final mostra as frases erradas com explicação.
- [ ] Jogável só com teclado, do início ao fim, com foco sempre visível.
- [ ] Funciona em 360px de largura com controles de toque.
- [ ] `README.md` explica como rodar e como o professor adiciona questões novas.
- [ ] `DECISIONS.md` lista as decisões tomadas onde a spec deixou liberdade.

---

## 13. Fora de escopo (não faça)

- Multiplayer, ranking online, contas de usuário, backend.
- Áudio e trilha sonora (pode existir um toggle desligado por padrão apenas se sobrar
  tempo — não é requisito).
- Sprites, imagens externas, ícones baixados: a cobra e a fruta são formas desenhadas no
  canvas.
- Geração de questões por IA em runtime. O banco é estático.
- Tempos verbais fora dos 12 tempos cobertos pelo menu (nada de subjuntivo, condicionais,
  voz passiva, modais ou reported speech como conteúdo próprio).
- Refatorar o formato do `questions.seed.json`.
- Adicionar biblioteca nova sem registrar o motivo em `DECISIONS.md`.
