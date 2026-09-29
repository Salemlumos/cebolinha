# Painel de mute por botões + isenção de administradores

Data: 2026-09-29
Status: implementado, testado, registrado no servidor de teste. Falta só
a validação manual do clique real no Discord (ver §6).
Base: estende `2026-09-28-call-management-v2-design.md` (não substitui).

## 1. Motivação

Digitar `/c-mute` e `/c-unmute` usuário por usuário é lento quando é preciso
silenciar/liberar várias pessoas seguidas numa call. Pedido do dono do
projeto: um comando com um painel de botões, tipo toggle, pra fazer isso
com um clique — e, à parte, que administradores nunca sejam silenciados
por nenhum desses comandos (evita um admin mutar outro por engano numa
ação em massa).

## 2. Superfície nova

| Comando | Parâmetros | Comportamento |
|---|---|---|
| `/c-mute-panel` | `canal` (voice, opcional — default: canal em que quem chamou está) | Responde efêmero (só quem chamou vê) com um botão por membro do canal. Clicar alterna mute/desmute daquele usuário e atualiza os botões na mesma mensagem. |

Nenhum comando existente foi removido; `/c-mute`, `/c-unmute`,
`/c-mute-all`, `/c-unmute-all` continuam como estavam, só ganharam a
isenção descrita em §4.

## 3. Design dos botões

Um `ButtonBuilder` por membro (`src/core/mute-panel-components.js`),
agrupados em linhas de 5 (limite do Discord: 5 linhas × 5 botões = 25
componentes por mensagem). Estado visual:

| Estado do membro | Estilo | Label |
|---|---|---|
| Livre (não mutado) | `Success` (verde) | `🔊 Nome` |
| Mutado | `Danger` (vermelho) | `🔇 Nome` |
| Isento (admin) | `Secondary` (cinza), **desabilitado** | `🛡️ Nome` |

`customId` de cada botão: `c-mute-toggle:<userId>` — carrega só o que é
necessário pra identificar o alvo no clique; o resto (guild, canal) já
vem do contexto da interação.

**Decisão:** o painel é sempre `ephemeral: true`. Isso resolve dois
problemas de uma vez: (1) só quem chamou o comando consegue ver e clicar
— o Discord já garante isso nativamente pra mensagens efêmeras — então
não é preciso checar de novo a permissão de quem clicou (ela já foi
checada pelo `default_member_permissions: ManageGuild` do próprio slash
command); (2) não poluiu o canal de texto com uma mensagem pública que
ninguém além do admin precisa ver.

## 4. Isenção de administradores (`src/core/mute-exempt.js`)

`isMuteExempt(member)` retorna `member.permissions.has(ManageGuild)` — a
mesma permissão que já é o piso de acesso a todo comando administrativo
do bot (decisão registrada em `2026-09-28`, depois do episódio real em
que nenhum cargo do servidor de teste tinha a permissão nativa
"Administrator"). Reaproveitar essa checagem, em vez de introduzir um
segundo conceito de "quem é admin", evita os dois definições divergirem
com o tempo.

Aplicada em três lugares:
- `/c-mute`: se o alvo é isento, responde erro amigável, não muta.
- `/c-mute-all`: filtra os isentos da lista de alvos, e reporta quem foi
  protegido na mensagem final (transparência — antes a descrição dizia
  "incluindo o host", agora diz o oposto, e o texto foi corrigido).
- `/c-mute-panel`: botão do isento nasce desabilitado, com o cadeado
  visual (🛡️), em vez de simplesmente não aparecer — mais claro pra quem
  está usando o painel do que "por que esse usuário não está na lista?".

`/c-unmute`/`/c-unmute-all` **não** ganharam a isenção — desmutar um
admin não é uma ação arriscada, não faz sentido bloquear.

## 5. Atualização do painel após o clique

O clique num botão (`interactionCreate` → `isButton()` →
`handleMuteToggle`, em `src/index.js`) faz:

1. Extrai o `userId` do `customId` clicado.
2. Busca o membro fresco (`guild.members.fetch`) — nunca confia em cache
   pra decidir se é isento ou se ainda está em voz.
3. Recusa (efêmero, só pra quem clicou) se o membro não existe mais, é
   isento, ou não está mais em nenhum canal de voz.
4. Alterna `member.voice.setMute(!member.voice.serverMute, ...)`.
5. Reconstrói **todos** os botões da mensagem (não só o clicado): lê
   `interaction.message.components` (estruturas `ActionRow`/`ButtonComponent`
   do próprio Discord, cada botão expõe `.customId` — confirmado lendo o
   código-fonte do discord.js, não assumido de memória), extrai os
   `userId`s de todos os botões existentes, busca cada membro de novo, e
   chama `buildMutePanelComponents` de novo com o estado atual de todos.
6. `interaction.update({ components })` — um único método que reconhece a
   interação do botão *e* edita a mensagem original, sem precisar de
   `deferUpdate`/`editReply` separados.

**Por que reconstruir todos os botões, não só o clicado:** se dois admins
abrirem painéis diferentes (ou o mesmo admin demorar pra clicar), o
estado de mute de quem *não* foi clicado pode ter mudado por outro
caminho (`/c-mute` direto, por exemplo) entre a abertura do painel e o
clique. Reconsultar tudo evita a UI mentir sobre o estado real.

## 6. Validação

**O que foi verificado de fato, com evidência:**
- `npm test`: 58 testes, todos verdes (12 arquivos), incluindo os 7 novos
  específicos desta feature:
  - `tests/core/mute-exempt.test.js` (2 casos)
  - `tests/core/mute-panel-components.test.js` (5 casos: agrupamento em
    linhas de 5, estilo/label por estado — livre/mutado/isento,
    truncamento em 25 botões)
- `npm run lint`: limpo.
- Todos os 17 comandos (`c-mute-panel` incluso) carregam sem erro via
  `commands/index.js` e serializam via `.toJSON()` sem lançar (validação
  interna do `SlashCommandBuilder` do discord.js).
- Registrado de fato no servidor de teste via API (`count: 17`).
- Confirmado lendo o código-fonte do discord.js instalado
  (`node_modules/discord.js/src/structures/ActionRow.js`) que
  `interaction.message.components` é uma lista de instâncias `ActionRow`
  com `.components` (array de `ButtonComponent`, que expõe `.customId`) —
  a suposição usada em `handleMuteToggle` bate com o código real, não é
  só memória da API.

**O que não foi (e não pode ser) verificado sem um clique real no
Discord:** o fluxo completo de `interactionCreate` → `isButton()` →
`handleMuteToggle` → `interaction.update(...)` nunca rodou contra o
gateway de verdade nesta sessão — não há como simular um clique de botão
sem um cliente Discord real. Pontos que só um teste manual confirma:
- O painel abre com os botões certos (cores/labels) pra gente de verdade
  num canal de voz.
- Clicar muta/desmuta de fato (efeito em `member.voice.serverMute`
  refletido no Discord) e a mensagem se atualiza sem erro.
- Um admin aparece com botão desabilitado e cadeado, na prática.
- Clicar num botão de alguém que já saiu do canal dá o erro amigável
  esperado, não uma exceção.

**Pendência:** dono do projeto testar `/c-mute-panel` num canal de voz
real com pelo menos um membro comum e um membro com "Gerenciar Servidor"
presentes, e confirmar os quatro pontos acima.
