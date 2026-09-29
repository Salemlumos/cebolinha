# Painel `/c-call-panel` v2 + correção de apelidos

Data: 2026-09-29
Status: implementado, testado (73 testes), aguardando teste manual ao vivo.
Estende: `2026-09-29-mute-panel-design.md` (o painel de mute virou o
`/c-call-panel`, ver `2026-09-29-call-management-v2-design.md` §3.2 pro
renome). Este documento cobre os ajustes feitos depois do primeiro uso
real do painel pelo dono do projeto.

## 1. Motivação

Quatro problemas relatados depois de usar o `/c-call-panel` e o
`/c-mute-all` de verdade:

1. Um usuário com o cargo **"Administração"** (não "Administrador")
   estava protegido contra mute — não deveria estar.
2. Iniciar/pausar/finalizar pelo painel não avisava ninguém na call —
   só o admin via o painel (é efêmero).
3. Não tinha botão de cancelar a gravação no painel.
4. Ao finalizar, não tinha nenhuma indicação de "transcrevendo...",
   "pronto" ou "deu erro" — o painel só mudava no final, ficando com
   cara de travado enquanto isso.

Mais um problema separado, em `/c-nickname`: apelidos definidos numa
gravação sumiam numa gravação seguinte em outro canal, voltando pro
nome do Discord na transcrição.

## 2. Isenção de mute: `ManageGuild` → `Administrator`

**Decisão:** `isMuteExempt` (`src/core/mute-exempt.js`) passa a checar a
permissão nativa `Administrator`, não mais `ManageGuild`.

Contexto: em `2026-09-28`, tínhamos trocado a exigência de acesso aos
comandos de `Administrator` para `ManageGuild`, porque nenhum cargo do
servidor de teste tinha `Administrator` (nem o cargo chamado
"Administrador"). Reaproveitamos esse mesmo `ManageGuild` pra decidir
quem é *protegido* contra mute — errado: no servidor de produção, o
cargo "Administração" tem `ManageGuild` (por isso consegue usar os
comandos) mas não deveria estar na lista de gente que nunca pode ser
mutada. **Quem pode usar um comando** e **quem é protegido contra ações
dele** são perguntas diferentes; usar o mesmo piso pra as duas foi o
erro.

Agora:
- Acesso aos comandos (`default_member_permissions` em cada comando):
  continua `ManageGuild`.
- Proteção contra mute (`isMuteExempt`): `Administrator`.

Efeito prático: pra proteger alguém de ser mutado, é preciso dar a
permissão `Administrator` de verdade a um cargo dele — não basta
"Gerenciar Servidor". Isso dá controle fino sem precisar de nome de
cargo (continua portátil entre servidores).

## 3. Avisos públicos pelas ações do painel

O painel é `ephemeral: true` (só o admin vê) — isso nunca mudou, é
proposital (§3 do doc anterior). Mas ações que mudam o estado da
gravação (`start`, `pause`, `finish`, `cancel`) afetam todo mundo na
call, que precisa saber — o requisito original do projeto já dizia isso
("Aviso de consentimento... é requisito, não opcional").

**Decisão:** cada uma dessas quatro ações, depois de atualizar o painel
efêmero, dispara um `interaction.followUp({ ephemeral: false })` — uma
mensagem pública separada no canal de texto, com o mesmo texto que
`/c-start`, `/c-pause`, `/c-finish`, `/c-cancel` já usavam quando
chamados diretamente. `followUp` funciona mesmo a resposta original
sendo efêmera — são mensagens independentes.

**`/c-mute-toggle` (o botão de cada usuário) não ganhou aviso público**
— decisão deliberada, não esquecimento: um admin pode clicar em vários
botões de mute em sequência rapidamente, e uma mensagem pública por
clique viraria spam. Mute/unmute individual já não tinha aviso quando
feito por engano nenhum outro fluxo do painel — só as mudanças de
estado da *gravação* (que são eventos raros e importantes) ganharam
isso.

## 4. Botão "Cancelar"

Adicionado `RECORDING_CANCEL_ID` (`c-panel-cancel`) em
`buildRecordingControlsRow`, mesma regra de habilitação que "Finalizar"
(`isActive`, ou seja, `recording`/`paused`). Chama `cancelSession` (já
existia, reaproveitado de `session-lifecycle.js`) e também avisa
publicamente.

**Cores revisadas** (a pedido de "melhore a aparência", ver §6):
Finalizar deixou de ser vermelho (`Danger`) — ele não é destrutivo, gera
uma transcrição. Agora é `Primary` (azul). Cancelar é que é destrutivo
(descarta os áudios sem transcrever), então ficou com `Danger`
(vermelho).

## 5. Indicativo de progresso da transcrição

`handlePanelFinish` (em `src/index.js`) agora tem três fases visíveis:

1. **Imediatamente** após o clique (`deferUpdate` + `editReply`): painel
   muda pra estado "⏳ Finalizando (transcrevendo...)", cor azul, os
   quatro botões de gravação ficam desabilitados.
2. **Durante o processamento**: `finishSession` roda (pode levar minutos,
   ver `2026-09-29-mute-panel-design.md`... na verdade ver a conversa
   sobre rate limit da Groq — não repetido aqui).
3. **Ao terminar**: painel volta pro estado real (`idle`, já que a sessão
   foi removida), e uma mensagem pública separada anuncia o resultado —
   sucesso (com os arquivos anexados), "nenhuma fala capturada", ou erro
   (áudios mantidos pra nova tentativa, mesmo comportamento de sempre).

## 6. Aparência: embed em vez de texto puro

`buildPanelEmbed({ channelName, sessionState })` (novo, em
`call-panel-components.js`) substitui o `content` de texto simples que
o painel usava. Muda de cor e texto de acordo com o estado:

| Estado | Cor | Texto |
|---|---|---|
| `idle` | cinza | ⚪ Parado |
| `recording` | vermelho | 🔴 Gravando |
| `paused` | amarelo | ⏸️ Pausado |
| `finishing` | azul | ⏳ Finalizando (transcrevendo...) |

O título mostra o nome do canal quando disponível (`🎛️ Painel — Geral`).
Como o painel nunca guarda o `channelId` explicitamente em lugar
nenhum (só os `userId`s nos `customId` dos botões de mute),
`resolvePanelChannelName` deriva o nome assim: usa o canal da sessão
ativa se houver (`session.voiceChannelId`), senão o canal atual do
primeiro membro listado no painel. É uma aproximação só pra exibição —
nunca afeta o que os botões realmente fazem.

## 7. Persistência de apelidos (`/c-nickname`)

**Causa raiz do bug relatado:** `nicknameStore` sempre foi só em
memória, por decisão explícita do design original (`2026-09-28`, §3.4:
"guardado em memória... sem persistência em disco"). Isso significa que
qualquer reinício do processo do bot apaga todos os apelidos. Durante o
desenvolvimento desta sessão, o bot foi reiniciado várias vezes (a cada
mudança de código) — o que na prática parece exatamente "apelido salvo
numa gravação, sumido na próxima", mesmo sem nenhum bug de lógica: o
código sempre leu/escreveu corretamente por `guildId` (não por canal),
então dentro do mesmo processo o apelido valeria em qualquer canal do
mesmo servidor.

**Correção:** `createNicknameStore(filePath)` agora aceita um caminho de
arquivo opcional. Se informado, carrega o JSON existente no início e
salva (sobrescreve o arquivo inteiro, é um blob pequeno) a cada
`set`/`remove`. `src/index.js` passa `DATA_DIR/nicknames.json`. Sem
`filePath` (usado nos testes), o comportamento é o de antes — só em
memória.

Continua **não sendo um banco de dados** (fora de escopo do projeto) —
é um arquivo JSON simples, do mesmo jeito que os WAVs de sessão já
ficam em `DATA_DIR`.

## 8. Validação

**Verificado com evidência:**
- `npm test`: 73 testes, 13 arquivos, todos verdes — incluindo:
  - `mute-exempt.test.js` reescrito pra `Administrator` (3 casos)
  - `call-panel-components.test.js`: botão Cancelar, cores Finalizar/
    Cancelar, estado `finishing` desabilita os 4 botões, embed com/sem
    nome de canal (13 casos)
  - `nickname-store.test.js` (novo): persiste, sobrevive a um novo
    `createNicknameStore` apontando pro mesmo arquivo (simula restart),
    remove persiste, não lança se o arquivo não existir ainda (5 casos)
- `npm run lint`: limpo.
- Os 17 comandos carregam e serializam sem erro; `/c-call-panel` não
  mudou nome/descrição/opções, então não foi preciso re-registrar no
  Discord.

**Não verificado (precisa de teste manual no Discord):**
- Clique real nos 4 botões de gravação, na ordem certa, com aviso
  público aparecendo de fato no canal.
- O embed renderizando com as cores/textos certos pros 4 estados.
- Alguém com `Administrator` de verdade ficando protegido, e alguém só
  com `ManageGuild` (ex.: "Administração") deixando de ficar.
- Apelido definido, bot reiniciado, apelido continuando a aparecer numa
  transcrição nova.

**Pendência:** dono do projeto testar os quatro pontos acima e reportar.
