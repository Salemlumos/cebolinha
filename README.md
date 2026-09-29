```
        \|  |/
       \ \  / /
        \ \/ /
       .-'--'-.
      /  o  o  \
     |     v    |
      \  ____  /
       '.____.'

   ____ _____ ____   ___  _     ___ _   _ _   _    _
  / ___| ____| __ ) / _ \| |   |_ _| \ | | | | |  / \
 | |   |  _| |  _ \| | | | |    | ||  \| | |_| | / _ \
 | |___| |___| |_) | |_| | |___ | || |\  |  _  |/ ___ \
  \____|_____|____/ \___/|_____|___|_| \_|_| |_/_/   \_\
```

[![CI](https://github.com/Salemlumos/cebolinha/actions/workflows/ci.yml/badge.svg)](https://github.com/Salemlumos/cebolinha/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![Node](https://img.shields.io/badge/node-%3E%3D22.12-brightgreen)](package.json)

Ola, cololindo! Aqui é o Cebolinha (ou "Cebolinda" plos inimigos), e esse
plojeto é meu: um bot de discold que gluva as chamadas de voz do seu
selvidol e faz uma tlanscrição automática de quem falou o quê — sem pagar
nada, sem entlar no meu computadol. Não muda nada eu falal l no lugal de
l, faz palte do pelsonagem, uó! A palti de agola eu vou falar celto
(pomete), pra você não se pelder nas instluções.

## O que ele faz

Bot de Discord open source pra gerenciar chamadas de voz de um servidor:
conectar/mover/desconectar/silenciar usuários, e gravar reuniões com
transcrição automática e identificação de quem falou. Pensado pra
servidores pequenos (equipes, grupos de reunião).

## Status

Fases 0-2 do design original implementadas, mais a v2 de gerenciamento de
chamadas (conexão desacoplada da gravação, comandos globais de
canal/usuário, fail-safe de inatividade). Veja `docs/superpowers/specs/`
para o histórico completo de decisões de design e `docs/superpowers/plans/`
para os planos de implementação.

## Comandos

Todos os comandos começam com `c-` (digite `/c-` no Discord pra listar
todos) e são restritos a **administradores do servidor** por padrão
(ajustável em Configurações do Servidor > Integrações > Cebolinha, se
quiser liberar algum pra outro papel).

### Gravação (exige o bot já conectado via `/c-join`)

Iniciar, pausar, finalizar e cancelar a gravação **não são mais comandos
separados** — ficam só no `/c-call-panel` (linha de botões de cima), pra
não ter dois jeitos de fazer a mesma coisa.

| Comando | O que faz |
|---|---|
| `/c-call-panel [canal]` | Abre um painel privado: botões 🔴 Iniciar/▶️ Retomar, ⏸️ Pausar, ⏹️ Finalizar, 🗑️ Cancelar, mais um botão por usuário pra mutar/desmutar com um clique (🔊 livre · 🔇 mutado · 🛡️ admin, protegido). Sem `canal`, usa o canal em que você está. Iniciar/pausar/finalizar/cancelar avisam publicamente no canal de texto, mesmo sendo acionados por um painel privado. |
| `/c-status` | Mostra estado, duração, quantidade de segmentos e quem já falou — informação que o painel não exibe. |

### Conexão do bot

| Comando | O que faz |
|---|---|
| `/c-join <canal>` | Conecta o bot ao canal informado, sem começar a gravar. |
| `/c-leave` | Desconecta o bot. Bloqueado se houver gravação ativa (finalize ou cancele antes). |

### Gerenciamento global (não exige o bot conectado)

| Comando | O que faz |
|---|---|
| `/c-call <usuário> <canal>` | Move um usuário para o canal informado. |
| `/c-disconnect <usuário>` | Expulsa um usuário da chamada em que estiver. |
| `/c-pull-all <canal_origem>` | Move todos de `canal_origem` para o canal de voz em que **você** está. |
| `/c-move-all <canal_origem> <canal_destino>` | Move todos de um canal para outro, ambos explícitos. |
| `/c-mute <usuário>` / `/c-unmute <usuário>` | Silencia/dessilencia um usuário específico, em qualquer canal. |
| `/c-mute-all <canal>` / `/c-unmute-all <canal>` | Silencia/dessilencia todo mundo em `canal`. Quem tem a permissão `Administrator` fica de fora. |
| `/c-nickname <usuário> <apelido>` | Define um alias **interno do bot** (não é o nickname real do Discord) usado na transcrição e no `/c-status`. Persiste em disco — sobrevive a reinícios do bot. |

Comandos de movimentação/mute exigem que o **bot** tenha as permissões
`Move Members` / `Mute Members` no servidor.

### Fail-safe: desconexão automática por inatividade

Se o bot ficar sozinho num canal (todo mundo saiu), inicia um timer
(`EMPTY_CHANNEL_TIMEOUT_MS`, padrão 5 minutos). Se alguém entrar antes, o
timer é cancelado. Se expirar com uma gravação ativa, aplica
`EMPTY_CHANNEL_POLICY` (`finish` por padrão — finaliza e posta a
transcrição; ou `cancel` — descarta) antes de desconectar, e avisa no
canal de texto da sessão.

## Transcrição — grátis, roda fora do seu servidor

A transcrição usa a [Groq](https://console.groq.com) — o mesmo modelo
Whisper open-source (`whisper-large-v3-turbo`), hospedado no hardware deles
(bem mais rápido que CPU comum), com tier gratuito, e **sem consumir
CPU/RAM do servidor onde o bot roda**. É o único provedor suportado. Passos:

1. Crie uma conta grátis em https://console.groq.com
2. Gere uma chave em https://console.groq.com/keys
3. No `.env`: `GROQ_API_KEY=gsk-...`

## Requisitos

- Node.js 22.12+ (`@discordjs/voice` e `vitest` exigem essa versão mínima)
- Uma aplicação criada no [Discord Developer Portal](https://discord.com/developers/applications)
- Uma chave grátis da Groq (veja acima)

## Instalação

```bash
npm install
cp .env.example .env
# edite .env com o token/client id da sua aplicação e sua GROQ_API_KEY
node src/index.js
```

Os slash commands são registrados automaticamente a cada boot (idempotente
— seguro rodar sempre). Não precisa de um passo manual separado.

## Variáveis de ambiente

Veja `.env.example` para a lista completa com comentários. As obrigatórias
são `DISCORD_TOKEN`, `DISCORD_CLIENT_ID` e `GROQ_API_KEY` — todo o resto
tem um default razoável.

| Variável | Default | Descrição |
|---|---|---|
| `DISCORD_GUILD_ID` | — (registro global) | Se definida, registra os comandos só nesse servidor (rápido, ideal em dev). |
| `TRANSCRIBE_MODEL` | `whisper-large-v3-turbo` | Modelo Groq a usar. |
| `TRANSCRIBE_LANGUAGE` | `pt` | Idioma passado ao transcritor. |
| `SILENCE_MS` | `1000` | Silêncio necessário pra considerar uma fala encerrada. |
| `MIN_SEGMENT_MS` | `400` | Segmentos mais curtos que isso são descartados. |
| `TRANSCRIBE_CONCURRENCY` | `3` | Quantos segmentos transcrever em paralelo. |
| `TRANSCRIBE_RPM_LIMIT` | `18` | Limite de requisições/minuto pro rate limiter da Groq (tier grátis = 20/min; deixamos margem). Suba se estiver num plano pago. |
| `KEEP_AUDIO` | `false` | Se `true`, não apaga os WAVs depois de finalizar a gravação. |
| `DATA_DIR` | `./data` | Onde os áudios ficam durante a sessão. |
| `EMPTY_CHANNEL_TIMEOUT_MS` | `300000` (5 min) | Tempo sozinho no canal antes do fail-safe agir. |
| `EMPTY_CHANNEL_POLICY` | `finish` | `finish` ou `cancel` — o que fazer com gravação ativa no fail-safe. |
| `LOG_LEVEL` | `info` | Nível de log (pino). |

## Configurar a aplicação no Discord Developer Portal

1. Acesse https://discord.com/developers/applications e crie (ou reuse) uma aplicação.
2. Em **Bot**, copie o token para `DISCORD_TOKEN` no `.env`, e o **Application ID** (na aba **General Information**) para `DISCORD_CLIENT_ID`.
3. Em **Bot**, os intents usados (`Guilds`, `GuildVoiceStates`) não são privilegiados — nada extra pra habilitar.
4. Em **OAuth2 > URL Generator**, marque os scopes `bot` e `applications.commands`, e as permissões `Connect`, `Move Members`, `Mute Members`, `Send Messages`, `Attach Files`.
5. Copie a URL gerada e use-a para convidar o bot ao seu servidor.

## Rodando o spike de gravação (opcional, só pra validar áudio/DAVE)

```bash
node scripts/spike-record.js <ID_DO_CANAL_DE_VOZ> <ID_DO_USUARIO_ALVO>
```

Para pegar o ID do canal de voz e do usuário: ative o **Modo Desenvolvedor**
em Configurações do Discord > Avançado, depois clique com o botão direito no
canal/usuário e escolha "Copiar ID". O script sai sozinho com `SPIKE PASSOU`
ou `SPIKE FALHOU` (com diagnóstico completo).

## Rodando com Docker (recomendado pra deploy)

```bash
docker compose up -d --build
```

Isso já cuida de build, `.env`, volume persistente pros áudios (`data/`) e
reinício automático (`restart: unless-stopped`). Sem `docker compose`, o
equivalente manual é:
```bash
docker build -t cebolinha .
docker run -d --name cebolinha --env-file .env -v cebolinha-data:/app/data --restart unless-stopped cebolinha
```

Usa a imagem `node:22-slim` (Debian/glibc) de propósito — **não troque para
`alpine`**: `ffmpeg-static` só tem binário pronto pra glibc; em Alpine
(musl) cairia numa tentativa de compilação nativa sem toolchain, do mesmo
jeito que aconteceu com `@discordjs/opus` localmente (por isso usamos
`opusscript` no lugar dele).

## Testes e lint

```bash
npm test
npm run lint
```

CI (`.github/workflows/ci.yml`) roda os dois, mais um build Docker de
validação, em todo push/PR pra `main`.

## Contribuindo

Veja [`CONTRIBUTING.md`](CONTRIBUTING.md) para o fluxo de setup, o que
testar antes de abrir um PR, e a estrutura do projeto.

## Licença

[MIT](LICENSE).

## Consentimento e privacidade

Este bot grava voz de pessoas reais. Iniciar/pausar/finalizar/cancelar pelo
`/c-call-panel` sempre avisa publicamente no canal de texto — nunca grave
sem esse aviso. Os áudios brutos são apagados automaticamente ao finalizar
ou cancelar
(ou pelo fail-safe de inatividade), exceto se `KEEP_AUDIO=true` no `.env`.

---

Pluntinho, é isso. Se algo não funcionar, abre uma issue que eu (quer
dizel, quem estivel cuidando do lepositólio) dou uma olhada. Tchau,
cololindo! 🧅
