# Cebolinha

Bot de Discord que grava calls de voz e gera transcrição com identificação de
quem falou. Uso pensado para servidores pequenos (reuniões, conversas em
grupo).

## Status

Fases 0, 1 e 2 implementadas: spike de gravação, comandos de sessão e
gravação/transcrição por falante. Veja `docs/superpowers/specs/` para o
desenho completo e `docs/superpowers/plans/` para o plano de implementação.

## Comandos

Todos os comandos começam com `c-` (fácil de listar digitando `/c-` no
Discord):

| Comando | O que faz |
|---|---|
| `/c-start` | Entra no canal de voz de quem chamou e começa a gravar (avisa no canal de texto). |
| `/c-pause` / `/c-resume` | Pausa/retoma a captura sem sair do canal. |
| `/c-status` | Mostra estado, duração, quantidade de segmentos e quem já falou. |
| `/c-finish` | Encerra, transcreve tudo e posta o `.md` no canal. Apaga os áudios depois, exceto se `KEEP_AUDIO=true`. |
| `/c-cancel` | Descarta a sessão e apaga os áudios, sem transcrever. |
| `/c-mute-all` / `/c-unmute-all` | Muta/desmuta todo mundo no canal de voz do bot (exceto o bot). Requer permissão "Mute Members". |

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
- `npm install`
- Uma aplicação criada no [Discord Developer Portal](https://discord.com/developers/applications)
- Uma chave grátis da Groq (veja acima)

## Instalação

```bash
npm install
cp .env.example .env
# edite .env com o token/client id da sua aplicação e sua GROQ_API_KEY
node scripts/register-commands.js
node src/index.js
```

## Configurar a aplicação no Discord Developer Portal

1. Acesse https://discord.com/developers/applications e crie (ou reuse) uma aplicação.
2. Em **Bot**, copie o token para `DISCORD_TOKEN` no `.env`, e o **Application ID** (na aba **General Information**) para `DISCORD_CLIENT_ID`.
3. Em **Bot**, habilite os intents privilegiados necessários: o código usa os intents `Guilds` e `GuildVoiceStates`.
4. Em **OAuth2 > URL Generator**, marque os scopes `bot` e `applications.commands`, e as permissões `Connect`, `Mute Members`, `Send Messages`, `Attach Files`.
5. Copie a URL gerada e use-a para convidar o bot ao seu servidor de teste.

## Rodando o spike da Fase 0 (opcional, só pra validar áudio/DAVE)

```bash
node scripts/spike-record.js <ID_DO_CANAL_DE_VOZ> <ID_DO_USUARIO_ALVO>
```

Para pegar o ID do canal de voz e do usuário: ative o **Modo Desenvolvedor**
em Configurações do Discord > Avançado, depois clique com o botão direito no
canal/usuário e escolha "Copiar ID". O script sai sozinho com `SPIKE PASSOU`
ou `SPIKE FALHOU` (com diagnóstico completo).

## Rodando com Docker

```bash
docker build -t cebolinha .
docker run -d --name cebolinha --env-file .env -v cebolinha-data:/app/data cebolinha
```

Usa a imagem `node:22-slim` (Debian/glibc) de propósito — **não troque para
`alpine`**: `ffmpeg-static` só tem binário pronto pra glibc; em Alpine
(musl) cairia numa tentativa de compilação nativa sem toolchain, do mesmo
jeito que aconteceu com `@discordjs/opus` localmente (por isso usamos
`opusscript` no lugar dele).

## Testes

```bash
npm test
```

## Consentimento e privacidade

Este bot grava voz de pessoas reais. `/c-start` sempre avisa explicitamente
no canal de texto que a gravação começou — nunca grave sem esse aviso. Os
áudios brutos são apagados automaticamente após `/c-finish` ou `/c-cancel`,
exceto se `KEEP_AUDIO=true` no `.env`.
