# DECISIONS.md

Decisões tomadas onde `CLAUDE.md` deixou liberdade, ou onde a especificação tinha uma
tensão que precisava ser resolvida. Ordem: das mais estruturais para as de detalhe.

---

## 1. A raiz do projeto é a pasta atual, não uma subpasta `snake-grammar/`

A §4 desenha a estrutura debaixo de `snake-grammar/`, mas `CLAUDE.md` e o banco de
questões já estavam na raiz da pasta de trabalho. Criar uma subpasta obrigaria a mover a
própria especificação. O `questions.seed.json` foi movido da raiz para `content/`, como a
§4 exige.

## 2. `engine.ts` recebe o agendador de quadros por injeção

A §4 diz que `engine.ts` usa `requestAnimationFrame`; a regra de ouro da mesma seção
proíbe `src/game/` de tocar em `window`. Resolvido injetando `schedule`/`cancel` no
construtor — `main.ts` passa `window.requestAnimationFrame`. O acumulador de tempo fixo
fica puro e testável, e a especificação continua valendo nas duas pontas.

## 3. Comer a fruta não faz a cobra crescer; responder certo faz

A §5.3 diz que a cabeça entra na célula da fruta e o jogo congela; a §5.4 diz que o
crescimento é o prêmio do acerto. Escolhi a leitura em que comer só abre a pergunta: o
passo que come não cresce, e o `+1` acontece quando a resposta é validada. Assim a
penalidade e o prêmio ficam simétricos, e o aluno vê a cauda crescer junto com o feedback.

## 4. O bloqueio de 180° compara com a última virada enfileirada

A §5.2 fala em "direção do tick atual", mas o buffer de 2 direções existe justamente para
o caso de duas teclas no mesmo tick. Comparar só com a direção atual deixaria passar
`cima` + `baixo` enfileirados juntos, que é o bug que o buffer deveria evitar. A validação
usa como referência a última direção já na fila (ou a atual, se a fila estiver vazia).

## 5. Crescer duplica a cauda em vez de guardar um contador

`grow()` acrescenta um segmento em cima do último. No passo seguinte ele se desdobra
naturalmente. É mais simples de testar do que um `pendingGrowth`, e mantém o invariante
"comprimento do array = comprimento da cobra" em todo momento.

## 6. A repescagem tem prioridade sobre a faixa de nível

Uma questão errada volta para a fila numa posição entre 3 e 6 à frente (§7.3) e é marcada
como "repescada". Quando ela chega à frente da fila, é servida mesmo que a faixa de fruta
atual peça outro nível. Sem isso, o filtro de nível poderia empurrar a repescagem para
fora da janela de 3 a 6 e quebrar a garantia pedagógica.

## 7. Nível mais próximo em caso de empate cai para o menor

Quando o nível alvo acabou, o seletor escolhe o nível com menor distância; havendo empate
(alvo 2, sobrando 1 e 3), fica com o primeiro encontrado na varredura, que é o de menor
distância registrada primeiro. Na prática isso favorece o nível mais fácil, que é o
comportamento menos frustrante para o aluno.

## 8. O cronômetro da pergunta usa `requestAnimationFrame`

Consequência: se o aluno trocar de aba durante a pergunta, o cronômetro congela junto com
o jogo. Isso é coerente com a §9.4 (o jogo pausa ao perder o foco) e evita punir quem foi
interrompido. A barra de progresso ganha animação suave de graça.

## 9. Dois módulos novos fora da lista da §4: `ui/shell.ts` e `ui/report.ts`

A §10 pede arquivos com menos de ~200 linhas. A montagem do DOM base saiu de `main.ts`
para `ui/shell.ts` (que também desenha a tela de erro do banco), e a construção do
relatório — cálculo de precisão, agrupamento por tempo verbal, texto para copiar — saiu de
`ui/overlays.ts` para `ui/report.ts`. Nenhum dos dois adiciona dependência.

## 10. O relatório é montado a partir de `attempts`, não de contadores paralelos

`GameState.attempts` guarda todo `AttemptLog` da partida. Precisão, desempenho por tempo
verbal e lista de frases erradas são derivados dele na hora do fim de jogo. Um estado a
menos para manter em sincronia.

## 11. Fim de jogo por encolhimento acontece na saída do feedback

A tabela da §5.6 tem `feedback → gameover`. Então `applyAnswer` só aplica a penalidade e
`resolveFeedback` é quem decide entre `countdown` e `gameover`. O aluno chega a ver o
feedback da questão que o matou, que é onde está o valor pedagógico.

## 12. `Escape` pausa; dentro do modal não faz nada

A §5.6 dá `Espaço ou Esc` para pausar e a §9.3 diz que Esc não fecha o modal. O modal
captura `Escape` e chama `stopPropagation`, então a tecla nunca chega ao controle global
enquanto a pergunta está aberta.

## 13. Botão em foco não dispara a ação global de Enter/Espaço

Um botão em foco já se ativa com Enter e Espaço. Sem uma guarda, "Jogar de novo" reiniciava
duas vezes (uma pelo clique, outra pelo atalho global). O tratador de teclado ignora
Enter/Espaço quando o alvo do evento está dentro de um `<button>`.

## 14. Fontes do Google Fonts com fallback de sistema

A §9.1 manda carregar as três famílias do Google Fonts; a §2 exige funcionar offline.
Mantive o `<link>` com `display=swap` e uma pilha de fallback em cada token
(`--font-mono` cai para `ui-monospace`, e assim por diante). Offline, o jogo abre e é
jogável — só perde a tipografia de marca. Nenhuma outra requisição de rede existe.

## 15. Cores do canvas lidas dos tokens CSS

`renderer.ts` lê `--snake`, `--fruit`, `--grid` e companhia via `getComputedStyle`. A
paleta continua vivendo só em `tokens.css`, como a §9.1 exige, sem duplicar hex no
TypeScript. Há fallback embutido caso o CSS ainda não tenha carregado.

## 16. `spawnFruit` devolve `null` quando o tabuleiro enche

Não há regra na especificação para tabuleiro cheio (exigiria 400 acertos). Em vez de
inventar uma vitória, `spawnFruit` devolve `null` e o estado mantém a fruta anterior. O
caso é testado, mas é inalcançável na prática.

## 17. PRNG próprio (mulberry32) em `game/board.ts`

A §7.3 pede embaralhamento seedado e determinismo nos testes, e a §2 proíbe dependências
de runtime. São 8 linhas de código próprio, usadas tanto pelo Fisher–Yates quanto pelo
sorteio da fruta.

## 18. ESLint 8 com `.eslintrc.cjs`

A §4 nomeia `.eslintrc.cjs`, que é o formato legado. O ESLint 9 usa `eslint.config.js` por
padrão. Fiquei com o ESLint 8 para respeitar o arquivo nomeado na especificação.

## 19. Observação sobre o banco de questões (nada foi alterado)

A §7.2 proíbe reescrever `questions.seed.json`, então ele está intacto e passa em todos os
testes de integridade. Fica registrada uma observação para o professor: em `ct-003`
("The train ___ when we got to the platform"), o distrator `already left` é ensinado como
errado, mas aparece no inglês americano coloquial. Se algum aluno reclamar, a discussão é
legítima — não é um erro do banco, é uma diferença registro/norma.

## 20. Testes além dos obrigatórios da §11

Além dos casos exigidos, existem testes em jsdom para o modal da pergunta
(`tests/questionModal.test.ts`), para os overlays e o relatório final
(`tests/overlays.test.ts`), para a persistência (`tests/persistence.test.ts`) e um teste de
partida completa (`tests/integration.test.ts`). O ambiente jsdom é declarado por arquivo,
com `// @vitest-environment jsdom`, para os testes de lógica pura continuarem rodando em
Node.

## 21. A penalidade por erro passou de 1 para 2 segmentos

Pedido do professor depois de jogar a primeira versão. A regra original da §5.4 era −1;
agora são **2 segmentos**, na constante `WRONG_PENALTY_SEGMENTS` de `config.ts` — não há
número mágico espalhado, e voltar para 1 é uma linha. `CLAUDE.md` §5.4 foi atualizado
junto, para a especificação não contradizer o código.

Efeito colateral que vale registrar: com `INITIAL_LENGTH: 3`, **o primeiro erro continua
encerrando a partida** — antes por 3 → 2, agora por 3 → 1. A penalidade maior só muda o
jogo depois do segundo acerto. Se a intenção for dar mais fôlego ao aluno antes da morte
súbita, o ajuste é subir `INITIAL_LENGTH`, não mexer na penalidade.
