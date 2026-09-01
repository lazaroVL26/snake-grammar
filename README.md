# Snake Grammar

Jogo web educativo para aula de inglês: o clássico Snake, mas **cada fruta comida abre
uma frase com lacuna sobre tempos verbais do inglês**. Na tela inicial o aluno escolhe o
conteúdo da rodada.

- Resposta certa → +10 pontos e a cobra **cresce** 1 segmento.
- Resposta errada (ou tempo esgotado) → a cobra **encolhe 2 segmentos**.
- Menos de 3 segmentos → fim de jogo.

No fim da partida o aluno recebe um relatório com precisão, desempenho por tempo verbal
e a lista das frases erradas com explicação — o material de revisão da aula.

## Apelido e ranking do dia

Antes de começar, o aluno escreve um **apelido** — sem ele a partida não inicia, porque o
ranking do dia não faria sentido. O apelido fica lembrado no navegador para as partidas
seguintes.

Toda partida terminada entra no **ranking de hoje**: apelido, pontuação, precisão e
conteúdo jogado. O ranking aparece na tela inicial (top 5) e no fim de jogo, com a partida
recém-jogada destacada e a colocação em evidência.

**O ranking zera sozinho a cada dia.** Cada partida guarda a data local em que foi jogada;
ao abrir o jogo, o que não é de hoje é descartado. Não há tarefa agendada nem nada para o
professor apertar — virou o dia, o ranking está limpo.

> **Importante — o ranking é por navegador.** O jogo não tem servidor (a especificação
> proíbe backend e exige funcionar offline), então o ranking mora no `localStorage` da
> máquina onde se joga. Num laboratório, **cada computador tem o seu próprio ranking**; os
> alunos não disputam entre máquinas. Para uma classificação da turma inteira, use o botão
> **"Copiar ranking"** na tela de fim de jogo: ele copia a lista do dia em texto, e os
> alunos colam num documento compartilhado. Uma disputa ao vivo entre máquinas exigiria um
> servidor, que está fora do escopo definido em `CLAUDE.md`.

## Conteúdos disponíveis

O menu da tela inicial tem cinco opções. O banco traz **101 frases**:

| Conteúdo                   | O que cai                                                        | Frases |
| -------------------------- | ---------------------------------------------------------------- | ------ |
| Simple Past x Past Perfect | O conjunto original: o que aconteceu antes do que já era passado | 41     |
| Presente                   | Present simple, continuous, perfect e perfect continuous         | 24     |
| Passado                    | Past simple, continuous, perfect e perfect continuous            | 53     |
| Futuro                     | Will, going to, future continuous e future perfect               | 24     |
| Todos os tempos            | Passado, presente e futuro embaralhados                          | 101    |

O conteúdo escolhido aparece no relatório final, e o desempenho continua separado por
tempo verbal — dá para ver que o aluno acerta Present Perfect mas erra Present Perfect
Continuous.

Interface em português do Brasil, exercício em inglês (nível A2–B1).

---

## Como rodar

Requer Node.js 20 ou mais novo.

```bash
npm install
```

```bash
npm run dev
```

Abra o endereço que o Vite imprimir (normalmente `http://localhost:5173`).

### Outros comandos

| Comando              | O que faz                                 |
| -------------------- | ----------------------------------------- |
| `npm run build`      | Type-check + build de produção em `dist/` |
| `npm run preview`    | Serve o build de produção                 |
| `npm run test`       | Roda os testes uma vez                    |
| `npm run test:watch` | Testes em modo observador                 |
| `npm run lint`       | ESLint com zero tolerância a warning      |
| `npm run format`     | Prettier                                  |

### Usar em sala

Depois de `npm run build`, a pasta `dist/` é um site estático: dá para copiar para um
pendrive, para o Moodle ou para qualquer servidor de arquivos. O jogo não faz nenhuma
chamada de rede em runtime — só as fontes do Google Fonts, que caem para fontes do
sistema se a máquina estiver offline. Recorde e estatísticas ficam no `localStorage` do
navegador do aluno.

---

## Como jogar

| Ação                    | Teclado                | Toque                       |
| ----------------------- | ---------------------- | --------------------------- |
| Mover                   | Setas ou WASD          | Swipe no tabuleiro ou D-pad |
| Começar / jogar de novo | Enter                  | Botão na tela               |
| Pausar / continuar      | Espaço ou Esc          | Botão na tela               |
| Marcar alternativa      | Teclas 1 a 4, ou setas | Toque na alternativa        |
| Confirmar resposta      | Enter                  | Botão "Responder"           |

Na tela inicial, `Enter` dentro do campo de apelido já começa a partida.

O jogo é 100% jogável só com teclado. Ele pausa sozinho quando a janela perde o foco ou
o aluno troca de aba.

Na tela inicial dá para escolher entre **múltipla escolha** e **digitação**. No modo
digitado a comparação é normalizada (maiúsculas, espaços e apóstrofos não importam, e
`had left` ≡ `'d left`), mas não há tolerância a erro no verbo — é justamente o que está
sendo avaliado.

---

## Como o professor adiciona questões novas

Todas as questões ficam em **`content/questions.seed.json`**, um array de objetos. Basta
acrescentar novos objetos no mesmo formato e rodar `npm run build`.

```json
{
  "id": "pp-016",
  "level": 2,
  "focus": "past-perfect",
  "sentence": "She didn't recognize him because they ___ for ten years.",
  "verbHint": "not meet",
  "options": ["hadn't met", "haven't met", "didn't meet", "weren't meeting"],
  "answerIndex": 0,
  "accepted": ["hadn't met", "had not met"],
  "explanation": "A causa é anterior ao momento passado da frase: Past Perfect."
}
```

| Campo         | Regra                                                                  |
| ------------- | ---------------------------------------------------------------------- |
| `id`          | Único no arquivo inteiro. Sugestão: `sp-`, `pp-` ou `ct-` + número     |
| `level`       | `1` (fácil), `2` (médio) ou `3` (difícil)                              |
| `focus`       | O tempo verbal da frase (lista completa abaixo)                        |
| `sentence`    | Exatamente uma lacuna, escrita como `___` (três sublinhados)           |
| `verbHint`    | Verbo no infinitivo, mostrado como pista                               |
| `options`     | Exatamente 4 alternativas, sem repetição                               |
| `answerIndex` | Índice (0 a 3) da alternativa correta em `options`                     |
| `accepted`    | Formas aceitas no modo digitado; precisa conter a alternativa correta  |
| `explanation` | 1 ou 2 frases **em português**, dizendo por que aquele tempo é o certo |

Valores válidos de `focus`, e em que conteúdo do menu cada um cai:

| `focus`                      | Conteúdo do menu                     |
| ---------------------------- | ------------------------------------ |
| `simple-past`                | Passado • Simple Past x Past Perfect |
| `past-continuous`            | Passado                              |
| `past-perfect`               | Passado • Simple Past x Past Perfect |
| `past-perfect-continuous`    | Passado                              |
| `contrast`                   | Passado • Simple Past x Past Perfect |
| `present-simple`             | Presente                             |
| `present-continuous`         | Presente                             |
| `present-perfect`            | Presente                             |
| `present-perfect-continuous` | Presente                             |
| `future-will`                | Futuro                               |
| `future-going-to`            | Futuro                               |
| `future-continuous`          | Futuro                               |
| `future-perfect`             | Futuro                               |

Todos caem também em "Todos os tempos". Para criar um conteúdo novo no menu, acrescente
uma entrada em [`src/quiz/topics.ts`](src/quiz/topics.ts) — o menu, o filtro das questões
e o relatório se ajustam sozinhos.

O jogo puxa `level: 1` nas 5 primeiras frutas, `level: 2` da 6ª à 12ª e `level: 3` daí em
diante. Se um nível acabar, ele cai para o nível mais próximo disponível — então vale a
pena manter os três níveis abastecidos.

### Regras de conteúdo (importante)

1. **A alternativa correta precisa ser a única gramaticalmente possível no contexto.**
   Nunca use como distrator uma forma que também estaria certa. Exemplo proibido:
   "After they ___ dinner, they went out" aceita `had` e `had had`.
2. Gatilhos claros de Past Perfect: `by the time`, `by 2018`, `already`,
   `never ... before`, discurso indireto, causa anterior explícita.
3. Marcadores claros de Simple Past: `yesterday`, `last night`, `in 2019`,
   `two weeks ago`, `at 9 a.m.`.
4. Distratores plausíveis: present perfect, presente simples, past continuous, particípio
   errado.
5. Vocabulário A2–B1, frases curtas, contexto cotidiano, sem conteúdo sensível.

### Validação automática

O arquivo é validado no carregamento. Se algo estiver errado, o jogo **não abre**: mostra
uma tela de erro listando os problemas e registra no console. Rode `npm run test` para
checar antes da aula — o teste `tests/questions.test.ts` roda sobre o arquivo real e
acusa id duplicado, número de opções diferente de 4, `answerIndex` inválido, frase sem
`___` e `accepted` que não contém a resposta correta. Outro teste falha se algum conteúdo
do menu ficar com menos de 12 frases ou menos de 4 por nível — se você criar um conteúdo
novo, ele avisa enquanto ainda falta material.

---

## Arquitetura em uma olhada

```
src/
├─ config.ts     constantes ajustáveis (velocidade, tempo da pergunta, pontos)
├─ game/         lógica pura do Snake — não toca em DOM nem canvas (exceto renderer.ts)
├─ quiz/         validação do banco, seleção de questões, verificação da resposta
├─ ui/           HUD, modal, overlays, relatório
├─ input/        teclado e toque
└─ storage/      recorde no localStorage
```

`src/game/` e `src/quiz/` são funções puras e testáveis: recebem estado e devolvem estado
novo. Toda entrada e saída acontece em `main.ts`, `ui/`, `input/`, `storage/` e
`game/renderer.ts`.

Para mudar velocidade, tempo da pergunta, pontuação ou tamanho da grade, mexa só em
[`src/config.ts`](src/config.ts).

Zero dependências de runtime: TypeScript, Vite, Vitest, ESLint e Prettier só em
`devDependencies`.

As decisões tomadas onde a especificação deixou liberdade estão em
[`DECISIONS.md`](DECISIONS.md).
