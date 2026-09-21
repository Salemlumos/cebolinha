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

## Transcrição — grátis por padrão, sem chave de API

Por padrão (`TRANSCRIBER_PROVIDER=local`), a transcrição roda **na própria
máquina** via Whisper (`@huggingface/transformers`, modelo
`Xenova/whisper-base`), sem custo e sem precisar de nenhuma chave de API. O
modelo é baixado uma vez (alguns MB) e cacheado; depois disso, roda offline.

Se preferir usar a API paga da OpenAI (mais rápida, geralmente mais precisa),
troque no `.env`:
```
TRANSCRIBER_PROVIDER=openai
OPENAI_API_KEY=sk-...
TRANSCRIBE_MODEL=whisper-1
```

## Requisitos

- Node.js 20+
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

## Testes

```bash
npm test
```

## Consentimento e privacidade

Este bot grava voz de pessoas reais. `/start` sempre avisa explicitamente no
canal de texto que a gravação começou — nunca grave sem esse aviso. Os
áudios brutos são apagados automaticamente após `/finish` ou `/cancel`,
exceto se `KEEP_AUDIO=true` no `.env`.
