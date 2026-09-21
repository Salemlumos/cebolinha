# Cebolinha

Bot de Discord que grava calls de voz e gera transcrição com identificação de
quem falou. Uso pensado para servidores pequenos (reuniões, conversas em
grupo).

## Status

Fase 0 (spike técnico) em andamento. Veja `docs/superpowers/specs/` para o
desenho completo e `docs/superpowers/plans/` para o plano de implementação.

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

Este bot grava voz de pessoas reais. Ao usar `/start` (Fase 1), o bot deve
avisar explicitamente no canal de texto que a gravação começou — nunca grave
sem esse aviso.
