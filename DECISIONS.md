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

## 22. Menu de conteúdos: grupos de tempos, não tempos avulsos

Pedido do professor: deixar o aluno escolher o que estudar, cobrindo todos os tempos do
inglês. O menu oferece **cinco conteúdos** — Simple Past × Past Perfect, Presente,
Passado, Futuro e Todos — em vez de listar os 13 valores de `Focus` um a um.

Motivo: um tempo verbal sozinho renderia 6 frases, e a partida repetiria as mesmas em
poucos minutos. Agrupado, o menor conteúdo tem 24. A granularidade fina existe onde ela
importa de verdade: **o relatório final separa o desempenho por tempo verbal**, então quem
escolheu "Presente" ainda descobre que errou só o Present Perfect Continuous. Criar um
conteúdo novo é acrescentar uma entrada em `quiz/topics.ts`.

## 23. Os três `Focus` antigos mantiveram a grafia original

`simple-past`, `past-perfect` e `contrast` continuam com esses nomes, mesmo que a
convenção nova pedisse `past-simple`. Renomear obrigaria a reescrever as 41 entradas
existentes de `questions.seed.json`, que a §7.2 manda não mexer. As 60 questões novas usam
`<tempo>-<aspecto>`; a mistura está documentada no próprio `types.ts`.

## 24. Nos itens de "going to", a lacuna cai na forma, não na escolha will × going to

A §8.1 exige que a alternativa correta seja a **única** possível. A fronteira entre `will`
e `going to` não é dessas: "Look at those clouds, it will rain" é gramatical, só menos
idiomático que "it's going to rain". Oferecer `will` como distrator quebraria a regra.

Por isso as frases de `future-going-to` põem o auxiliar antes da lacuna — "it's ___ rain"
— de modo que só `going to` encaixa, e quem ensina o gatilho (evidência visível, plano
anterior) é a explicação em português. O mesmo cuidado vale nos itens de `future-perfect`,
onde `will finish` nunca aparece ao lado de `will have finished`, e nos de
`present-perfect-continuous`, que não oferecem o present perfect simples quando as duas
formas seriam aceitáveis.

## 25. O ranking é JSON no `localStorage`, não um arquivo em disco

O pedido foi "salvo no json". Sem servidor não existe escrita de arquivo a partir de uma
página estática, e a §2 proíbe backend e exige funcionar offline. O ranking é, então, JSON
gravado em `localStorage`, na chave `snake-grammar:scores:v1` — separada de
`snake-grammar:v1` justamente para poder ser zerada sem levar junto o recorde pessoal.

A consequência precisa ficar explícita, e está no README: **o ranking é por navegador**.
Num laboratório, cada máquina tem a sua lista. O botão "Copiar ranking" existe para
contornar isso sem servidor — o aluno cola o texto num documento da turma.

## 26. O reset diário é lazy, não agendado

Cada entrada guarda o dia local (`AAAA-MM-DD`) em que a partida aconteceu.
`loadScoreboard` descarta o que não é de hoje e regrava a lista já podada. Não há
`setInterval` nem tarefa à meia-noite: o ranking "zera" na primeira leitura do dia
seguinte, que é o único momento em que alguém olharia para ele. Menos código e nenhum
estado vivo para manter.

O dia é o do relógio da máquina do aluno. Numa turma com fusos diferentes, cada navegador
vira o dia no seu próprio horário — irrelevante para uso em sala.

## 27. Apelido obrigatório para começar

Sem apelido o ranking vira uma lista de anônimos e perde a função. O botão "Começar" e o
`Enter` global passam por `Overlays.requestStart()`, que leva o foco ao campo e avisa em
vez de iniciar. O jogo continua 100% jogável só com teclado: o campo recebe foco sozinho
quando ainda não há apelido, e `Enter` dentro dele começa a partida.

O apelido é aparado (espaços colapsados, caracteres invisíveis removidos, 16 caracteres no
máximo) antes de ir para o ranking — nada de layout quebrado por nome gigante colado.

## 28. O piloto automático dos testes lê a direção da cobra no canvas

O teste de partida completa em jsdom dirige a cobra até a fruta. Ele rastreava a direção
por conta própria, e esse palpite podia divergir do jogo quando uma tecla era recusada —
o que produzia uma falha de 1 em 4 execuções, com a cobra batendo na parede.

Agora a direção é deduzida do que o renderer desenhou (cabeça menos o segmento seguinte), e
a tecla é reenviada a cada quadro enquanto for preciso, já que o jogo descarta viradas
duplicadas. Sem estado paralelo, sem divergência: 12 execuções seguidas da suíte completa
sem falha. O defeito era do arnês de teste, nunca do jogo.

## 29. O ranking virou uma coluna ao lado do tabuleiro

Pedido do professor. Antes a lista aparecia dentro do painel da tela inicial e se repetia
no fim de jogo — só era visível quando ninguém estava jogando, que é justamente quando ela
menos importa. Agora é um `<aside class="rank-side">` irmão do tabuleiro, visível a
partida inteira.

A §9.2 dizia "coluna única centralizada, largura máxima ~640px". A coluna do jogo continua
com 640px; a partir de 960px de viewport entra uma segunda coluna de 232px à direita, com
`position: sticky`. Abaixo de 960px ela desce para o fim da página — **depois** do D-pad,
para não empurrar os controles de toque para fora da tela em 360px. A §9.2 foi atualizada.

Com a lista sempre à vista, o painel de fim de jogo deixou de repeti-la: sobrou só a
colocação ("2º lugar de 5 partidas hoje"), que é a informação que ele acrescenta.

## 30. O destaque do ranking compara conteúdo, não referência

`scoreboardList` marcava a linha do aluno com `entry === highlight`. Funcionava no teste
de unidade, onde os dois lados são o mesmo objeto, mas nunca funcionaria de verdade: a
coluna lateral é redesenhada a partir de `loadScoreboard()`, que reserializa tudo do
`localStorage` e devolve objetos novos.

O teste de ponta a ponta pegou o defeito. A comparação passou a ser por conteúdo
(`playedAt` + `nick` + `score`), que sobrevive à ida e volta pelo JSON.

## 31. Entrou um servidor, porque ranking de turma não existe sem ele

O professor vai hospedar e a turma joga simultaneamente, cada aluno num PC. Com o ranking
em `localStorage`, cada máquina teria a sua lista e ninguém disputaria com ninguém — a
limitação que eu já tinha registrado na decisão 25. Perguntei, e ele escolheu ranking
compartilhado. A §2 e a §13 do `CLAUDE.md` foram atualizadas: backend deixou de ser
proibido, mas só este.

O servidor é Node com módulos internos apenas: `http`, `fs`, `path`, `os`. **Zero
dependências**, nada de Express, nada de banco. São dois arquivos e nenhum passo de build,
o que mantém a promessa de "roda em qualquer PC com Node instalado".

Ele serve `dist/` e a API na mesma porta. Isso evita CORS, evita configurar endereço de API
no cliente e reduz o que pode dar errado na sala para uma coisa só: a porta estar liberada.

## 32. O relógio e a data são do servidor, não do aluno

Cada PC da escola pode ter a data errada. Se o cliente carimbasse `date`, um aluno com o
relógio em 2019 sumiria do ranking do dia e outro poderia ressuscitar a lista de ontem.
`sanitizeEntry` descarta `playedAt` e `date` que venham no corpo e usa o relógio do
servidor. O reset diário passa a ser uma decisão de um relógio só.

## 33. Escritas em fila, arquivo trocado por rename

Trinta alunos podem terminar a partida no mesmo segundo. Um `read-modify-write` ingênuo
perderia partidas nos pontos de `await`, e uma escrita interrompida deixaria o JSON pela
metade — perdendo o dia inteiro.

Toda operação passa por uma fila (`this.queue = this.queue.then(...)`), e a gravação
escreve num `.tmp` e faz `rename`, que é atômico no mesmo sistema de arquivos. Há teste com
40 escritas simultâneas e com 30 POSTs de verdade por HTTP, conferindo que nenhuma se perde
e que todas as leituras concorrentes veem a mesma lista.

## 34. Cada aluno aparece uma vez, com a melhor partida

Guardar todas as partidas e listar todas faria quem joga dez vezes ocupar o ranking
inteiro. O arquivo continua guardando o histórico do dia (até 500 partidas), mas a lista
devolvida é deduplicada por apelido, mantendo a melhor. Comparação sem diferenciar
maiúsculas: "ana" e "ANA" são a mesma pessoa.

## 35. Sem servidor, o jogo não quebra — degrada

Se o servidor cair no meio da aula, `fetchRanking` e `submitScore` caem para o
`localStorage` daquele PC e a coluna avisa "Sem conexão com o servidor". A partida é
gravada localmente **sempre**, mesmo quando o envio dá certo, então nada se perde. Quando o
servidor volta, a lista da turma reaparece na atualização seguinte.

As chamadas têm `AbortSignal.timeout(3s)`: servidor lento não pode travar a tela do aluno.
A tela de fim de jogo aparece na hora, com "Enviando para o ranking...", e a colocação
entra quando a resposta chega — atualizando só aquele parágrafo, para não remontar o painel
e roubar o foco do teclado.

## 36. A lista se atualiza sozinha, mas não em aba escondida

A coluna do ranking consulta o servidor a cada 5 segundos, **só com a aba visível** — trinta
navegadores em segundo plano batendo no servidor não ajudariam ninguém. Ao voltar para a
aba, a atualização é imediata, sem esperar o próximo ciclo. Respostas fora de ordem são
descartadas por um contador de geração.

## 37. Bootstrap entrou como base, mas só o CSS e só via npm

Pedido do professor. Contraria a §2 original ("sem frameworks de UI", "zero dependências
de runtime"), que foi atualizada. Três limites que impus para não estragar o que já
funcionava:

**Só o CSS.** O JavaScript do Bootstrap não entra. O modal da pergunta tem foco preso,
cronômetro de 20s e Esc bloqueado — comportamento próprio, testado, que o JS do Bootstrap
atrapalharia. Uso as classes e escrevo o comportamento.

**Via npm, nunca CDN.** O CSS é empacotado no build. Um `<link>` para CDN quebraria o
requisito de rodar offline, que é o cenário da sala de aula.

**As classes antigas continuam.** Cada elemento tem a classe semântica do projeto _e_ a do
Bootstrap: `class="option list-group-item ..."`. Assim os 231 testes seguem valendo e o
CSS próprio continua tendo onde se apoiar.

Custo: o CSS do bundle foi de 11 KB para 244 KB (34 KB comprimido). Para uma rede local de
escola é irrelevante; se um dia incomodar, dá para trocar pelo Bootstrap compilado só com
os componentes usados.

## 38. `.modal` era colisão direta: virou `.question-modal`

`.modal` é classe do Bootstrap, com `display: none; position: fixed`. A nossa era o cartão
do diálogo — importar o Bootstrap teria escondido a pergunta inteira. Rodei uma checagem
das 119 classes do projeto contra o CSS do Bootstrap; essa foi a única colisão real, e o
diálogo passou a se chamar `question-modal`.

## 39. A paleta continua sendo a nossa, via variáveis do Bootstrap

`styles/bootstrap-theme.css` mapeia os tokens de `tokens.css` para as variáveis do
Bootstrap (`--bs-body-bg`, `--bs-btn-bg`, `--bs-card-bg`, `--bs-list-group-*`). O `<html>`
leva `data-bs-theme="dark"` para os padrões escuros. Nenhum componente usa cor crua do
Bootstrap, então a §9.1 continua valendo: fundo azul-noite, cobra em amarelo marca-texto,
frase em IBM Plex Mono e a lacuna piscando como cursor.

## 40. A atualização periódica não pode cancelar o envio da partida

Achado por um teste que quebrou durante esta mudança, mas o defeito era do jogo, não do
teste. `refreshRanking` e o envio do fim de partida compartilhavam um contador de geração
para descartar respostas fora de ordem. Se o ciclo de 5 segundos disparasse enquanto o
envio estava em voo, ele invalidava o envio — e a colocação ficava presa em "Enviando para
o ranking da turma..." para sempre.

Agora são dois contadores: `refreshToken` para as consultas e `submitToken` para os
envios. O envio ainda invalida consultas em voo (elas trariam a lista sem a partida que
acabou), mas nunca o contrário. Há teste avançando 30 segundos de relógio com a resposta
pendente.

## 41. Tela cheia maximiza a página, não o tabuleiro

O alvo natural pareceria ser o `.board`, mas o modal da pergunta mora em `.modal-root`,
fora do canvas. Com `requestFullscreen` no tabuleiro, só a subárvore dele seria pintada e
**a pergunta sumiria da tela** — o jogo ficaria travado. O alvo é
`document.documentElement`.

O estado vem do evento `fullscreenchange`, não de uma variável nossa: quem sai pelo Esc ou
pelo F11 também vê o rótulo do botão voltar para "Tela cheia". O botão se esconde sozinho
quando `document.fullscreenEnabled` é falso, e a promessa recusada (iframe sem permissão)
é engolida — o jogo segue na tela normal.

## 42. A linha do tabuleiro é flexível, não uma folga fixa em rem

A primeira tentativa foi `height: calc(100dvh - 13rem)`. Medindo no navegador, o espaço
real acima e abaixo era 540px, e muda conforme o D-pad aparece ou não. Em vez de calibrar
um número mágico, a tela cheia dá altura de viewport ao `.shell` e
`grid-template-rows: auto auto minmax(0, 1fr)` — cabeçalho, HUD e depois o tabuleiro
ocupando o que sobrar. Ajusta-se sozinho.

Duas correções que só apareceram medindo: o `100dvh` precisava descontar o respiro do
`body`, senão sobrava scroll exatamente dessa folga; e abaixo de 960px, com o ranking no
fluxo, a altura fixa espremia o tabuleiro para **44px**. As regras de dimensionamento
ficaram dentro de `@media (min-width: 960px)`; em tela estreita a tela cheia apenas
esconde a moldura do navegador.

Resultado num monitor de 1920x1080, sem D-pad: tabuleiro de 640px para **916px**, sem
barra de rolagem.

## 43. Regressão do Bootstrap: os estados de seleção sumiram

O professor relatou que não dava para saber qual conteúdo estava marcado e que havia texto
grudado. Eram dois defeitos meus, da migração para o Bootstrap:

**O bloco `.choice` inteiro foi apagado.** Ao enxugar o `app.css` removi o trecho entre os
botões e o ranking, e junto foram `.choice`, `.choice__label`, `.choice__detail` e
`.choice--on`. Sem eles, valia o `display: block` do `.list-group-item`: rótulo e descrição
viraram uma linha só ("Simple Past x Past PerfectO que aconteceu antes...") e o item
marcado ficou idêntico aos outros.

**As regras de convivência venciam os estados.** `.choice.list-group-item` tem duas classes
e vinha depois de `.choice--on`, que tem uma — o mesmo valia para `.option--selected`,
`.option--ok`, `.option--err` e `.ranking__row--mine`. Ou seja, **a alternativa marcada no
quiz e a linha do próprio aluno no ranking também estavam sem destaque**, não só o menu.

Agora os estados usam duas classes (`.choice.choice--on`) e ficam depois da convivência.
Todos os pares novos foram conferidos em contraste: o menor é 4,99:1, ainda AA.

## 44. O item marcado usa quatro sinais, não só cor

Depender de um fundo levemente tingido era o que tornava a seleção difícil de enxergar.
O item marcado agora tem barra de acento à esquerda, borda, rótulo em `--snake-head` e uma
marca de conferido desenhada em CSS — sem emoji, como manda a §9.5. Quatro sinais
independentes, e nenhum deles exige distinguir tons próximos.

A tipografia ganhou papel maior: Bricolage Grotesque nos rótulos das escolhas, nos números
do ranking e nas pontuações; marca-texto sob o título, no amarelo da cobra, fechando com a
direção de arte de "caderno de idiomas encontrando fliperama" da §9.1.

## 45. A barra do cronômetro estava travada em 100%

O professor pediu que a barra "corresse" conforme o tempo. Ela já era reescrita a cada
quadro, mas nunca se mexia: sobrou no `app.css` a regra antiga `.timer__bar { flex: 1 }`,
e dentro do `.progress` do Bootstrap (que é `display: flex`) o `flex` estica o item para a
trilha inteira, ignorando a largura. Regra antiga removida.

Dois detalhes vieram junto. O `.progress-bar` do Bootstrap traz `transition: width .6s`,
que faria a barra correr atrasada em relação ao cronômetro — a transição ficou só na cor.
E a virada para vermelho no fim mudava apenas a variável `--bs-progress-bar-bg`: quando só
a custom property muda, a transição não reinterpola e a cor ficava presa no amarelo. A cor
passou a ser declarada direto em `background-color`, além da variável.

Há teste que falha se a barra parar de encolher a cada quadro.

## 46. Ranking passou a mostrar o top 10, e a coluna precisou crescer

`SCOREBOARD_VISIBLE` foi de 5 para 10. O corte estava sendo aplicado nos painéis que
deixaram de listar o ranking (decisão 29), então a coluna lateral vinha mostrando a lista
inteira — o `RankingPanel` passou a cortar, que é onde a política de "top N" pertence.
"Copiar ranking" continua levando tudo.

Com dados reais apareceu um defeito de layout: a coluna de precisão tinha `min-width` de
3,2rem e o `gap` era largo, sobrando **14px para o apelido**, que aparecia cortado. A
coluna foi de 232px para 264px e as demais faixas encolheram; medido em 1280px, 960px e
360px, nenhum apelido trunca.

## 47. As colunas do ranking moram na lista, não em cada linha

O professor viu o ranking "quebrado na tela". Cada `<li>` era um grid próprio, então as
faixas `auto` de pontuação e precisão se dimensionavam de forma independente: com
pontuações de tamanhos diferentes (300, 150, 90, 5) os números não alinhavam de uma linha
para a outra, e a lista ficava torta.

As colunas passaram para o `<ol>` e cada linha as reaproveita com `grid-template-columns:
subgrid`. A linha continua sendo uma caixa, então o fundo e o contorno da partida do
próprio aluno continuam funcionando — o que não aconteceria com `display: contents`.

Há fallback em `@supports not (grid-template-columns: subgrid)` com faixas fixas, que
alinham do mesmo jeito. Medido em 1000px e 360px: as bordas direitas de pontuação e
precisão são idênticas em todas as linhas, e nenhum apelido trunca.

## 48. Os dois botões de copiar saíram

Pedido do professor. Saíram "Copiar relatório" e "Copiar ranking"; no fim de jogo sobra
"Jogar de novo".

O de relatório era exigido pela §5.5 e pelo Definition of Done — a §5.5 foi atualizada. O
relatório continua na tela, com precisão, desempenho por tempo verbal e a lista das frases
erradas; o que sumiu foi só a cópia para a área de transferência.

O de ranking já tinha perdido a razão de ser quando o servidor entrou (decisão 31): ele
existia para o professor juntar máquinas que não se enxergavam, e hoje a lista da turma
inteira vive em `data/scores.json`, no PC servidor.

Junto saiu o código que ficou órfão: `reportToText` em `ui/report.ts` e `scoreboardToText`
em `storage/scoreboard.ts`, com os testes que os cobriam. Se um dia a cópia fizer falta,
está no histórico.

## 49. Mais de uma alternativa ficava verde no feedback

Relatado pelo professor como "frases com mais de uma resposta correta". Não era o banco: as
questões estão certas e a correção da resposta sempre esteve certa também. O defeito era só
na hora de pintar o feedback.

`showFeedback` comparava com `button.textContent.endsWith(answer)`, e o `textContent` do
botão começa com o número do atalho. Com a resposta certa `started` e o distrator
`had started`, `"2had started".endsWith("started")` é verdadeiro — os dois ficavam verdes.
**11 das 101 questões** caíam nisso, sempre o mesmo padrão: certa numa forma simples,
distratores em `had X` / `have X`.

Pior que feio: ensinava o contrário do exercício, já que o aluno via duas formas marcadas
como corretas justamente onde a questão quer que ele distinga uma da outra.

Cada alternativa passou a guardar o próprio texto em `data-option`, e a comparação é exata
sobre ele (normalizada). É o mesmo erro que eu já tinha cometido no arnês de teste na
decisão sobre o piloto automático — dessa vez estava no produto.

A pontuação nunca foi afetada: `confirm()` usa `presented.options[selected]` e
`isChoiceCorrect` compara texto exato normalizado. Quem errou foi contado como erro.

## 50. Fliperama de verdade, sem sacrificar a leitura

Pedido do professor: fontes e cores mais gamificadas. A §9.1 já dizia "caderno de idiomas
encontrando fliperama", então o caminho foi puxar o lado fliperama, não trocar a direção
de arte.

**Press Start 2P entrou como quarta família** (`--font-arcade`), mas só onde o texto é
número ou rótulo curto: placar, contagem regressiva, título, posições e pontuações do
ranking, atalhos 1–4. **Nunca em texto corrido** — ela é larga e cansativa em frase longa,
e os alunos são A2–B1. A frase do exercício continua em IBM Plex Mono, que é a assinatura
pedagógica, e a leitura de interface continua em Inter.

**Um token de cor novo:** `--accent: #7cc6ff`, azul de fliperama, para a sequência de
acertos e os atalhos das alternativas. Os brilhos são `--glow-snake` e `--glow-accent`,
derivados da paleta com `color-mix` — nada de cor solta fora dos tokens, como a §9.1 exige.

**O placar pulsa** quando o número muda, o que dá o retorno de "ganhei ponto" que faltava.
A animação respeita `prefers-reduced-motion`.

Medido antes de fechar: os sete pares de cor novos ficam entre 8,2:1 e 12,9:1, folgado
acima de AA. Em 360px o título ocupa 179px dos 360 e nenhum valor do placar estoura a
célula, nem com "12 / 34" ou "9999" — Press Start 2P é larga, então isso precisava ser
conferido, não presumido.
