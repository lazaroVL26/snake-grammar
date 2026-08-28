# PROMPT — para colar no Claude Code

> Coloque `CLAUDE.md` e `content/questions.seed.json` na pasta vazia do projeto,
> abra o Claude Code nela e cole o texto abaixo (a partir da linha "Você vai construir").
> Rode com permissão de edição e execução de comandos (`claude` e aceitar as ações de
> arquivo/terminal), senão ele vai parar a cada passo.

---

Você vai construir, sozinho e do início ao fim, o projeto **Snake Grammar**.

**Antes de escrever qualquer código, leia `CLAUDE.md` por inteiro.** Ele é a
especificação completa e a fonte da verdade: stack, regras do jogo, arquitetura,
constantes, identidade visual, acessibilidade, testes obrigatórios e Definition of Done.
Leia também `content/questions.seed.json` — é o banco de questões pronto, **não o
reescreva nem o "melhore"**, apenas consuma e valide.

Resumo em uma frase, para você não se perder: é um jogo Snake em TypeScript + Vite +
Canvas 2D onde, a cada fruta comida, abre um modal com uma frase em inglês com lacuna
sobre **Simple Past × Past Perfect**; acertar dá 10 pontos e faz a cobra crescer, errar
faz a cobra **perder 1 segmento**; abaixo de 3 segmentos é game over.

## Como trabalhar

Trabalhe em fases, na ordem abaixo. **Ao fim de cada fase, rode os comandos de
verificação e só avance quando estiverem verdes.** Não peça confirmação entre as fases —
siga sozinho até o fim. Faça um commit por fase, com mensagem no formato
`feat(fase-2): loop do jogo e movimento da cobra`.

### Fase 1 — Fundação
Scaffold do Vite com TypeScript vanilla, `tsconfig` em modo strict (com
`noUncheckedIndexedAccess`), ESLint, Prettier, Vitest, scripts do `package.json`,
estrutura de pastas da §4 do CLAUDE.md, `src/config.ts` com todas as constantes,
`src/types.ts` com todos os tipos.
✅ Verificação: `npm run build`, `npm run lint` e `npm run test` rodam sem erro (pode não
haver teste ainda).

### Fase 2 — Núcleo do jogo (lógica pura, sem UI)
`game/snake.ts`, `game/board.ts`, `game/collision.ts`, `game/state.ts`, `game/engine.ts`.
Nenhum desses arquivos pode importar DOM, canvas ou algo de `src/ui`. PRNG injetável para
tudo que for aleatório. Escreva os testes desta fase junto com o código.
✅ Verificação: todos os testes de `snake`, `board`, `collision` e `state` da §11 passam.

### Fase 3 — Renderização e input
`game/renderer.ts` (única parte que toca no contexto 2D, com `devicePixelRatio`),
`input/keyboard.ts` (setas + WASD, buffer de direção, Espaço/Esc para pausar),
`input/touch.ts` (swipe e D-pad em telas pequenas), `main.ts` amarrando tudo.
✅ Verificação: a cobra anda, come, cresce, morre na parede e no próprio corpo. Jogável só
com teclado.

### Fase 4 — Quiz
`quiz/questions.ts` (import + validação do JSON, falha alto e clara se o banco estiver
inconsistente), `quiz/selector.ts` (embaralhamento seedado, sem repetição, repescagem de
erros em 3–6 posições, progressão de nível), `quiz/answer.ts` (normalização e comparação).
✅ Verificação: testes de `selector` e `answer` da §11 passam, mais o teste de integridade
que roda sobre o arquivo real `questions.seed.json`.

### Fase 5 — Interface
`ui/hud.ts`, `ui/questionModal.ts` (focus trap, teclas 1–4, Enter, Esc não fecha,
cronômetro de 20s com barra, `aria-live`), `ui/overlays.ts` (tela inicial com escolha
entre múltipla escolha e digitação, pausa, contagem regressiva de retomada, game over com
relatório), `styles/tokens.css` e `styles/app.css` seguindo **exatamente** a paleta e a
tipografia da §9 do CLAUDE.md — inclusive a assinatura visual (a frase em IBM Plex Mono e
o verbo se encaixando na lacuna).
✅ Verificação: fluxo completo jogável — comer, responder certo, crescer, responder errado,
encolher, morrer por encolhimento, ver relatório, jogar de novo.

### Fase 6 — Persistência, polimento e entrega
`storage/persistence.ts` (recorde e estatísticas), pausa automática ao perder foco da aba,
responsividade até 360px, `prefers-reduced-motion`, foco visível, contraste AA.
Escreva o `README.md` (como rodar, como jogar, **como o professor adiciona questões
novas**) e o `DECISIONS.md` (decisões que você tomou onde a spec deu liberdade).
✅ Verificação: percorra o checklist inteiro da §12 (Definition of Done) e marque cada item.
Se algum falhar, conserte antes de encerrar.

## Regras de conduta

- **Não peça permissão a cada passo.** Decida, implemente, registre em `DECISIONS.md`.
- **Não adicione dependência de runtime.** Nada de React, Phaser, Tailwind, lodash.
- **Não invente conteúdo gramatical novo** a menos que precise ampliar o banco — e, nesse
  caso, siga as 7 regras da §8 do CLAUDE.md, especialmente a primeira: a alternativa
  correta tem que ser a única gramaticalmente possível no contexto.
- **Não deixe teste quebrado nem `console.log`** no código final.
- Se encontrar uma contradição real no CLAUDE.md, escolha a interpretação mais simples,
  implemente e anote em `DECISIONS.md`. Não pare para perguntar.
- Ao terminar, responda com: o que foi construído, como rodar, o resultado dos três
  comandos de verificação e o checklist da §12 preenchido.

Comece pela Fase 1 agora.
