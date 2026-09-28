# Contribuindo

Obrigado pelo interesse! Esse é um projeto pequeno, então o processo é simples.

## Setup

```bash
npm install
cp .env.example .env
# preencha DISCORD_TOKEN, DISCORD_CLIENT_ID e GROQ_API_KEY com credenciais
# de uma aplicação/servidor de teste seus — nunca use credenciais reais
# de produção pra desenvolver
```

Veja o `README.md` para os passos completos de configuração no Discord
Developer Portal.

## Rodando localmente

```bash
npm test          # testes unitários (vitest)
npm run lint       # eslint
npm run format     # prettier --write
node scripts/register-commands.js   # registra os slash commands (use DISCORD_GUILD_ID no dev)
node src/index.js                   # roda o bot
```

## Antes de abrir um PR

- `npm test` e `npm run lint` precisam passar — o CI roda os dois em todo PR.
- Comandos que tocam voz/Discord (`src/commands/*.js`, `src/index.js`,
  `src/core/recorder.js`) não são testáveis por unidade — teste manualmente
  num servidor de teste antes de abrir o PR e descreva como testou.
- Módulos puros (`src/core/session.js`, `src/services/formatter.js`,
  `src/services/transcriber/run-batch.js`, `src/config/env.js`) **precisam**
  de testes cobrindo o comportamento novo.
- Sem `console.log` de debug esquecido, sem `catch` vazio, sem segredo
  commitado.

## Estrutura do projeto

```
src/
  index.js              # bootstrap, login, fail-safe de inatividade
  config/env.js         # validação de env (zod)
  commands/             # um arquivo por slash command
  core/                 # máquina de estados, recorder, registries (sem I/O externo em session.js)
  services/             # formatter, transcriber (Groq)
  utils/                # logger, cebolinha-speak
scripts/                # spike de gravação, registro de comandos
tests/                  # espelha a estrutura de src/
docs/superpowers/       # specs e planos de design (histórico de decisões)
```

## Reportando bugs / sugerindo features

Abra uma issue descrevendo o comportamento esperado vs. observado (bugs) ou
o caso de uso (features). Para bugs de voz/Discord, inclua os logs — o bot
loga com contexto estruturado (`guildId`, `sessionId`).
