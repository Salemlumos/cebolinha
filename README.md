# Cebolinha

Bot de Discord que grava calls de voz e gera transcrição com identificação de
quem falou. Uso pensado para servidores pequenos (reuniões, conversas em
grupo).

## Status

Fases 0, 1 e 2 implementadas: spike de gravação, comandos de sessão e
gravação/transcrição por falante. Veja `docs/superpowers/specs/` para o
desenho completo e `docs/superpowers/plans/` para o plano de implementação.

## Comandos

| Comando | O que faz |
|---|---|
| `/start` | Entra no canal de voz de quem chamou e começa a gravar (avisa no canal de texto). |
| `/pause` / `/resume` | Pausa/retoma a captura sem sair do canal. |
| `/status` | Mostra estado, duração, quantidade de segmentos e quem já falou. |
| `/finish` | Encerra, transcreve tudo e posta o `.md` no canal. Apaga os áudios depois, exceto se `KEEP_AUDIO=true`. |
| `/cancel` | Descarta a sessão e apaga os áudios, sem transcrever. |
| `/mute-all` / `/unmute-all` | Muta/desmuta todo mundo no canal de voz do bot (exceto o bot). Requer permissão "Mute Members". |

## Transcrição — grátis por padrão, roda fora do seu servidor

Por padrão (`TRANSCRIBER_PROVIDER=groq`), a transcrição usa a [Groq](https://console.groq.com)
— o mesmo modelo Whisper open-source (`whisper-large-v3-turbo`), só que
hospedado no hardware deles (bem mais rápido que CPU comum), com tier
gratuito, e **sem consumir CPU/RAM do servidor onde o bot roda**. Passos:

1. Crie uma conta grátis em https://console.groq.com
2. Gere uma chave em https://console.groq.com/keys
3. No `.env`: `GROQ_API_KEY=gsk-...`

Outras opções (trocando `TRANSCRIBER_PROVIDER` no `.env`):

- **`local`** — roda Whisper na própria máquina (`@huggingface/transformers`,
  modelo `Xenova/whisper-base`), sem chave, sem serviço externo, mas usa
  CPU/RAM do servidor do bot e é mais lento. Bom se não quiser depender de
  nenhum serviço de terceiros.
- **`openai`** — API paga da OpenAI. Exige `OPENAI_API_KEY` e `TRANSCRIBE_MODEL=whisper-1`.

## Requisitos

- Node.js 22.12+ (`@discordjs/voice`, `openai` e `vitest` exigem essa versão mínima)
- `npm install`
- Uma aplicação criada no [Discord Developer Portal](https://discord.com/developers/applications)

## Instalação

```bash
npm install
cp .env.example .env
# edite .env com o token e client id da sua aplicação
```

## Configurar a aplicação no Discord Developer Portal

1. Acesse https://discord.com/developers/applications e crie (ou reuse) uma aplicação.
2. Em **Bot**, copie o token para `DISCORD_TOKEN` no `.env`, e o **Application ID** (na aba **General Information**) para `DISCORD_CLIENT_ID`.
3. Em **Bot**, habilite os intents privilegiados necessários: o código usa os intents `Guilds` e `GuildVoiceStates`.
4. Em **OAuth2 > URL Generator**, marque os scopes `bot` e `applications.commands`, e as permissões `Connect`, `Mute Members`, `Send Messages`, `Attach Files`.
5. Copie a URL gerada e use-a para convidar o bot ao seu servidor de teste.

## Rodando a Fase 0 (spike de gravação)

Antes de qualquer outra funcionalidade, valide que a recepção de áudio e a
criptografia DAVE funcionam no seu ambiente:

```bash
npm install
cp .env.example .env   # preencha DISCORD_TOKEN e DISCORD_CLIENT_ID
node scripts/spike-record.js <ID_DO_CANAL_DE_VOZ> <ID_DO_USUARIO_ALVO>
```

Para pegar o ID do canal de voz e do usuário: ative o **Modo Desenvolvedor**
em Configurações do Discord > Avançado, depois clique com o botão direito no
canal/usuário e escolha "Copiar ID".

Depois de ver a mensagem "Conectado. Fale continuamente...", a pessoa cujo ID
foi informado deve falar por ~10 segundos. O script sai sozinho com:

- `SPIKE PASSOU`: gravou um WAV em `data/spike/` com áudio real (não silêncio). Abra o arquivo em qualquer player para confirmar.
- `SPIKE FALHOU`: pare e reporte o log completo (ele inclui as versões instaladas do discord.js/@discordjs/voice/@snazzah/davey) antes de avançar para a próxima fase.

## Rodando com Docker

```bash
docker build -t cebolinha .
docker run -d --name cebolinha --env-file .env -v cebolinha-data:/app/data cebolinha
```

O build já baixa e cacheia o modelo Whisper padrão (`TRANSCRIBE_MODEL` do
`.env.example`) na própria imagem — o container não precisa de rede pra
transcrever, só pra falar com o Discord. Se usar um modelo diferente em
runtime, ele é baixado sob demanda no primeiro `/finish` (com rede).

Usa a imagem `node:22-slim` (Debian/glibc) de propósito — **não troque para
`alpine`**: `onnxruntime-node` e `ffmpeg-static` só têm binário pronto pra
glibc; em Alpine (musl) cairia numa tentativa de compilação nativa sem
toolchain, do mesmo jeito que aconteceu com `@discordjs/opus` localmente.

## Testes

```bash
npm test
```

## Consentimento e privacidade

Este bot grava voz de pessoas reais. `/start` sempre avisa explicitamente no
canal de texto que a gravação começou — nunca grave sem esse aviso. Os
áudios brutos são apagados automaticamente após `/finish` ou `/cancel`,
exceto se `KEEP_AUDIO=true` no `.env`.
