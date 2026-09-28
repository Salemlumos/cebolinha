# Cebolinha v2 — comandos de gerenciamento de chamadas

Data: 2026-09-28
Status: rascunho — aguardando revisão
Supersede parcialmente: `2026-09-21-cebolinha-design.md` (mantido como
registro histórico; este documento define os deltas de comportamento e
superfície de comandos a partir da Fase 2 já implementada).

## 1. Objetivo

Expandir o bot de "grava a call de quem chamou `/start`" para um bot de
**gerenciamento de chamadas de voz do servidor**: gravação continua
existindo, mas desacoplada da conexão do bot; comandos de administração de
canais/usuários passam a funcionar globalmente, independente de o bot
estar conectado.

## 2. O que muda em relação à Fase 1/2 já implementada

- **Gravação e conexão se separam.** Hoje `/c-start` faz duas coisas:
  entra no canal de quem chamou *e* começa a gravar. A partir daqui, quem
  conecta o bot é `/c-join`; `/c-start` só liga/desliga a captura,
  assumindo que o bot já está em algum canal.
- **`/c-start` passa a também retomar de `paused`.** O fluxo pedido é
  `start → pause → start → finish` — sem um comando `resume` separado.
  `/c-resume` é removido; `/c-start` fica "context-aware": se a sessão
  está `paused`, retoma; se está `idle` (bot já conectado), inicia.
- **Comandos globais de canal/usuário não dependem de o bot estar
  conectado.** `call`, `disconnect`, `pull-all`, `move-all`, `mute`,
  `nickname` operam via API do Discord diretamente sobre canais/membros do
  servidor, sem tocar em `@discordjs/voice`.
- **Todos os comandos ficam restritos a administradores.** Antes só
  `mute-all`/`unmute-all` exigiam uma permissão específica; agora todo
  comando exige `Administrator` por padrão (ver §7).
- **Novo fail-safe de inatividade**: desconexão automática se o bot ficar
  sozinho no canal.

Convenção mantida: todo comando continua com prefixo `c-` (decisão anterior
registrada em `2026-09-21`).

## 3. Superfície de comandos completa (pós-mudança)

### 3.1 Controle da gravação (exige bot já conectado via `/c-join`)

| Comando | Parâmetros | Comportamento |
|---|---|---|
| `/c-start` | — | Se a sessão está `paused`, retoma a captura. Se está `idle`, começa a gravar no canal onde o bot já está (`getVoiceConnection`, não o canal de quem chamou). Erro amigável se o bot não estiver conectado a nenhum canal (`/c-join` primeiro) ou se já estiver `recording`. |
| `/c-pause` | — | Pausa a captura, mantém a sessão (`paused`). Erro amigável se não há sessão `recording`. |
| `/c-finish` | — | Encerra a captura, transcreve (Groq), posta o `.md`, apaga os áudios (exceto `KEEP_AUDIO=true`). Comportamento inalterado da Fase 2. |
| `/c-cancel` | — | Descarta a sessão e os áudios, sem transcrever. Comportamento inalterado. |
| `/c-status` | — | Mantido (não estava no pedido, mas nada indica removê-lo). Mostra estado/duração/segmentos/quem falou. |

**Decisão:** `/c-start` e `/c-pause` **não** desconectam o bot do canal —
só controlam a captura. Só `/c-leave` (ou o fail-safe de inatividade)
desconecta.

### 3.2 Controle da conexão do bot

| Comando | Parâmetros | Comportamento |
|---|---|---|
| `/c-join` | `canal` (voice channel, obrigatório) | Conecta o bot ao canal informado (`selfDeaf: false`). Não inicia gravação. Erro amigável se já conectado em outro canal deste servidor (peça `/c-leave` antes, ou trate como "mover" — ver §3.2.1). |
| `/c-leave` | — | Desconecta o bot do canal atual. **Não** finaliza nem cancela gravação automaticamente — ver §3.2.2. |

#### 3.2.1 `/c-join` enquanto já conectado

**Decisão:** se o bot já está em outro canal do mesmo servidor, `/c-join`
**move** a conexão pro novo canal (assim como `joinVoiceChannel` já faz
nativamente ao chamar de novo com outro `channelId`), em vez de dar erro —
mais simples e é o comportamento nativo do `@discordjs/voice`. Se houver
uma gravação `recording`/`paused` ativa, o comando é **bloqueado** com
erro amigável ("finalize ou cancele a gravação atual antes de mudar de
canal"), pra não gravar pedaços em dois canais misturados na mesma sessão.

#### 3.2.2 `/c-leave` com gravação ativa

**Decisão:** se houver sessão `recording`/`paused`, `/c-leave` é
**bloqueado** com erro amigável pedindo `/c-finish` ou `/c-cancel`
primeiro — mesma lógica do fail-safe de inatividade (§7), pra ter uma
única política de "o que fazer com a gravação ao desconectar" em vez de
duas.

### 3.3 Gerenciamento global de canais/usuários (não exige bot conectado)

| Comando | Parâmetros | Comportamento |
|---|---|---|
| `/c-call` | `usuario`, `canal` | Move `usuario` para `canal` (`GuildMember.voice.setChannel`). Requer `Move Members`. |
| `/c-disconnect` | `usuario` | Expulsa `usuario` da chamada em que estiver (`setChannel(null)`). Requer `Move Members`. Erro amigável se o usuário não estiver em nenhum canal de voz. |
| `/c-pull-all` | `canal_origem` | Move todos os membros de `canal_origem` para o **canal de voz em que o admin que chamou o comando está** (puxa "pra mim"). Requer `Move Members`, e requer que o admin esteja em um canal de voz (senão erro amigável). |
| `/c-move-all` | `canal_origem`, `canal_destino` | Move todos os membros de `canal_origem` para `canal_destino`. Requer `Move Members`. |

**Decisão sobre `pull-all` vs `move-all`:** o texto original descreve os
dois de forma idêntica ("mover todos de um canal para outro"). Resolvi a
duplicação assim: `pull-all` = "traga todos pra mim" (1 parâmetro, destino
implícito = canal do admin); `move-all` = transferência genérica A→B (2
parâmetros explícitos). Padrão comum em bots de moderação de voz do
Discord. **Se a intenção era outra, me avise antes de eu implementar.**

### 3.4 Apelido (alias interno do bot)

| Comando | Parâmetros | Comportamento |
|---|---|---|
| `/c-nickname` | `usuario`, `apelido` | Define um alias **interno do bot** para `usuario` neste servidor, usado no lugar do nome de exibição do Discord ao montar transcrições e no `/c-status`. |

**Decisão:** `apelido` aqui **não** é o nickname real do Discord (que
exigiria a permissão sensível `Manage Nicknames` e mudaria o nome de todo
mundo ver no servidor). É um alias que só o bot usa internamente — guardado
em memória (`Map<guildId, Map<userId, string>>`, sem persistência em
disco, consistente com o resto do projeto). `recorder.js` consulta esse
alias antes de cair para `member.displayName`. Isso resolve o caso de uso
real descrito ("identificação pelo bot") sem precisar de uma permissão
adicional. **Se a intenção era mudar o nickname real do Discord, me
avise — é uma implementação diferente (e mais arriscada).**

### 3.5 Controle de áudio

| Comando | Parâmetros | Comportamento |
|---|---|---|
| `/c-mute` | `usuario` | Server-mute em `usuario`, em qualquer canal, sem exigir o bot conectado. Requer `Mute Members`. Erro amigável se o usuário não estiver em voz. |
| `/c-unmute` | `usuario` | Inverso do `/c-mute`. (Não estava na especificação nova, mas é o par natural — mantenho por simetria; ver §8 se quiser remover.) |
| `/c-mute-all` | `canal` (obrigatório) | Muta todos em `canal`, **incluindo o host** (quem começou a call) — ninguém é excluído por papel. O próprio bot nunca é alvo (mutar o bot não tem efeito). Requer `Mute Members`. |
| `/c-unmute-all` | `canal` (obrigatório) | Inverso do `/c-mute-all`. |

**Decisão:** `canal` passa a ser **obrigatório** em `mute-all`/`unmute-all`
(hoje é inferido de `getVoiceConnection`) — mais consistente com os outros
comandos globais desta seção, e continua funcionando mesmo se o bot não
estiver conectado a nada.

## 4. Máquina de estados da sessão — o que muda

O módulo `core/session.js` (puro, testável) ganha uma mudança de
transição: `start` passa a aceitar dois estados de origem:

```
idle → recording       (start, bot já conectado)
paused → recording      (start, retomando)
recording → paused      (pause)
recording|paused → finishing → done   (finish → complete)
idle|recording|paused → cancelled     (cancel)
```

Isso é uma mudança pequena e localizada em `applyEvent`'s `TRANSITIONS.start.from`,
que passa de `['idle']` para `['idle', 'paused']`. Todo o resto do módulo
(testado com 24 casos hoje) não muda.

**Importante:** `session.start()` não recebe mais `voiceChannelId` do
`interaction.member.voice.channel` (isso não existe mais nesse fluxo) — o
comando `/c-start` lê o canal a partir do `VoiceConnection` já existente
(`getVoiceConnection(guildId).joinConfig.channelId`).

## 5. Novo módulo: registro de conexão por guild

Hoje `joinVoiceChannel`/`getVoiceConnection` do `@discordjs/voice` já
mantêm esse registro globalmente — não precisamos de um Map próprio pra
"o bot está conectado em qual canal". `/c-join`, `/c-leave` e `/c-start`
usam `getVoiceConnection(guildId)` diretamente. Isso é consistente com o
que `mute-all`/`unmute-all`/`finish`/`cancel` já fazem hoje.

## 6. Fail-safe: desconexão automática por inatividade

- **Gatilho:** evento `voiceStateUpdate` do discord.js. Sempre que alguém
  entra/sai de um canal onde o bot está, recalcula quantos humanos
  (excluindo o bot) restam nesse canal.
- **Zero humanos:** inicia um `setTimeout` de `EMPTY_CHANNEL_TIMEOUT_MS`
  (novo env, default 5 minutos = `300000`).
- **Alguém entra antes do timeout:** cancela o timer (`clearTimeout`).
- **Timeout expira:**
  - Sem sessão ativa (`idle`): desconecta silenciosamente (`connection.destroy()`), loga o evento.
  - Sessão `recording`/`paused`: **decisão** — finaliza a gravação
    automaticamente (mesmo caminho de `/c-finish`: transcreve, posta,
    limpa) em vez de cancelar. Justificativa: descartar uma call já
    gravada por todo mundo ter saído é uma perda de dados mais grave do
    que gerar uma transcrição "sobrando" — e é reversível (quem não
    quiser o arquivo, ignora/apaga no Discord), enquanto cancelar não é.
    Configurável via novo env `EMPTY_CHANNEL_POLICY` (`finish` | `cancel`,
    default `finish`), pra quem preferir o outro comportamento sem tocar
    em código.
- **Registro:** todo disparo do fail-safe loga em `pino` com
  `{ guildId, channelId, policy }`.

**Novo env:**
```
EMPTY_CHANNEL_TIMEOUT_MS=300000
EMPTY_CHANNEL_POLICY=finish
```

Implementação: `src/core/inactivity-watcher.js`, função pura
`shouldDisconnect(humanCount) -> boolean` (testável sem timers reais) +
uma camada fina em `src/index.js` que liga isso ao evento
`voiceStateUpdate` e aos timers reais (não testável por unidade, testado
manualmente como o resto do que toca `@discordjs/voice`).

## 7. Permissões — todos os comandos exigem administrador

**Decisão:** todo comando usa
`.setDefaultMemberPermissions(PermissionFlagsBits.Administrator)` como
piso. Isso não impede um dono de servidor liberar comandos específicos
pra outros papéis depois (Discord permite override por comando em
Configurações do Servidor > Integrações > \[nome do bot\]) — só define o
padrão como "só admin" na instalação, conforme pedido em "todos os
comandos devem ser restritos aos administradores autorizados".

Comandos que além disso *agem* sobre voz/membros (`c-call`,
`c-disconnect`, `c-pull-all`, `c-move-all`, `c-mute*`, `c-join`) também
precisam que o **bot** tenha, na prática, `Move Members` / `Mute Members`
no servidor — se faltar, erro amigável nomeando a permissão que falta
(mesmo padrão já usado em `mute-all` hoje).

## 8. Comandos que ficam de fora deste documento (herdados, sem mudança)

`/c-status` continua existindo (não foi pedido pra remover).
`/c-unmute`/`/c-unmute-all` continuam existindo como pares naturais de
`/c-mute`/`/c-mute-all` (a especificação nova não os lista, mas também não
pede remoção — sem eles não haveria como desfazer um mute). Se a intenção
era realmente não ter unmute, me avise.

## 9. Fora de escopo deste documento

Multi-sessão por servidor (mais de um canal gravando ao mesmo tempo),
persistência em disco/DB dos apelidos e da configuração de inatividade
(fica só em `.env`/memória), UI de configuração — nada disso foi pedido
aqui e continua fora de escopo conforme o documento original.

## 10. Decisões que preciso que você confirme antes de eu implementar

1. `pull-all` = "traga todos pro meu canal" vs `move-all` = "A → B
   explícito" — é isso mesmo, ou a diferença pretendida era outra?
2. `/c-nickname` como alias interno (só transcrição/`/status`), não o
   nickname real do Discord — confirma?
3. Fail-safe de inatividade com gravação ativa: finalizar (não cancelar)
   por padrão — de acordo?
4. `/c-join` enquanto já conectado em outro canal: mover a conexão (se não
   houver gravação ativa) em vez de dar erro — de acordo?
5. Manter `/c-status`, `/c-unmute` e `/c-unmute-all` mesmo não estando na
   lista nova — de acordo?
6. Todos os comandos com piso `Administrator` por padrão, incluindo
   `/c-start`/`/c-pause`/`/c-finish`/`/c-cancel` (hoje qualquer membro pode
   usar) — confirma essa restrição também pros comandos de gravação, não
   só os de gerenciamento?
