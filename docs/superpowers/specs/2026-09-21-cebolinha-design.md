# Cebolinha — bot de Discord para gravação e transcrição de calls

Data: 2026-09-21
Status: aprovado (fase 0 em andamento)

## 1. Objetivo

Bot de Discord (JavaScript, Node.js ESM) que entra em um canal de voz a pedido,
grava cada participante em stream separado, e ao final gera uma transcrição
com identificação de quem falou. Uso em servidores pequenos para atas de
reunião/conversas em grupo. Fora de escopo: transcrição em tempo real, painel
web, banco de dados, escala multi-instância.

## 2. Descobertas técnicas (pesquisa feita em 2026-09-21)

- `@snazzah/davey` (DAVE — criptografia ponta a ponta) vem como dependência
  do próprio `@discordjs/voice` a partir da 0.19.2, junto com `discord.js`
  >= 14.27. A negociação do protocolo é feita internamente pela lib; a
  aplicação não precisa orquestrar `DAVESession` manualmente. O risco vira:
  garantir essas versões e **confirmar na prática** (Fase 0) que o áudio
  recebido decripta e não chega vazio/corrompido.
- Recepção de áudio segue o padrão do exemplo oficial `discordjs/voice`
  (`examples/recorder`): `receiver.subscribe(userId, { end: { behavior:
  EndBehaviorType.AfterSilence, duration } })`, decodificado com
  `prism-media`. Esse padrão ainda é o atual (verificado no repo
  `discordjs/voice` em 2026-09-21).
- Versões fixadas nesta data (registry npm): `discord.js@14.27.0`,
  `@discordjs/voice@0.19.2`, `@snazzah/davey@0.1.12`, `@discordjs/opus@0.10.0`,
  `prism-media@1.3.5`, `ffmpeg-static@5.3.0`, `zod@4.6.5`, `pino@10.3.1`,
  `vitest@5.0.1`, `openai@7.20.0`.

## 3. Decisões de projeto

- Repositório novo e independente em `I:\dev\projets\cebolinha`, sem relação
  com outros projetos do usuário.
- Gerenciador de pacotes: npm.
- Framework de testes: `vitest` (escolhido por ergonomia com mocks/timers
  para testar retry/concorrência de transcrição e a máquina de estados).
- Pipeline de áudio: `prism-media` decodifica Opus → PCM 48kHz estéreo;
  um processo `ffmpeg` (via `ffmpeg-static`) faz downmix/resample para WAV
  16kHz mono via pipe (stdin/stdout), sem arquivo intermediário.
- Estado de sessão: em memória, um `Map<guildId, Session>` no
  `session-manager`. Sem persistência em disco/DB (fora de escopo).
- Estrutura de pastas, comandos, variáveis de ambiente e formato do
  transcript: conforme especificado pelo dono do projeto (seções 4-9 da
  tarefa original, reproduzidas abaixo).

## 4. Comandos (slash commands)

| Comando | Comportamento |
|---|---|
| `/start` | Exige chamador em canal de voz e nenhuma sessão ativa no servidor. Bot entra com `selfDeaf: false`, inicia sessão, avisa no canal de texto que a call está sendo gravada. |
| `/pause` | Válido só em `recording`. Mantém conexão, para de capturar áudio novo. |
| `/resume` | Válido só em `paused`. Volta a capturar. |
| `/finish` | Encerra captura, fecha segmentos abertos, sai do canal, transcreve tudo, monta transcript ordenado, posta como anexo. |
| `/cancel` | Descarta sessão e apaga áudios, sem transcrever. |
| `/status` | Mostra estado, duração, quantidade de segmentos, quem já falou. |
| `/mute-all` | Server mute em todos do canal do bot exceto o bot. Requer Mute Members no bot e no invocador. Falhas por membro não abortam o comando. |
| `/unmute-all` | Inverso do anterior. |
| `/summary` (Fase 3) | Ata via `Summarizer` atrás de interface. |
| `/vocab` (Fase 3) | Glossário por servidor, enviado ao transcritor. |

Regras gerais: uma sessão por guild; `deferReply` em comandos longos;
mensagens em português; `default_member_permissions` em comandos sensíveis.

## 5. Máquina de estados

`idle → recording ⇄ paused → finishing → done` (mais `cancelled`).
Transições inválidas retornam erro amigável, nunca exceção não tratada.
Módulo puro (`core/session.js`), testável sem I/O.

## 6. Captura e segmentação

- Ao detectar fala, assina o stream no receiver com
  `EndBehaviorType.AfterSilence` (duração configurável, padrão 1000ms).
- Decodifica Opus → PCM → WAV 16kHz mono.
- Cada fala é um segmento em
  `DATA_DIR/sessions/<sessionId>/<timestamp>_<userId>.wav`, com metadados
  `userId`, nome de exibição, `startedAt`, `endedAt`.
- Descarta segmentos menores que `MIN_SEGMENT_MS` (padrão 400ms).
- Em `paused`, não cria assinaturas novas nem grava.
- Erros de stream por segmento não derrubam a sessão.

## 7. Transcrição

- Interface `Transcriber`: `transcribe(filePath, { language, vocabulary }) →
  Promise<{ text }>`.
- Um adaptador: OpenAI (modelo configurável via env). Interface pronta para
  adaptador local futuro (não implementado agora).
- Idioma padrão `pt`.
- Concorrência limitada (padrão 3), retry com backoff em falhas transitórias.
  Segmento que falha definitivamente vira `[trecho não transcrito]`;
  `/finish` continua.
- Trata limite de tamanho de arquivo aceito pela API do provedor.

## 8. Formato do transcript

- Ordenado por `startedAt`; mescla segmentos consecutivos do mesmo falante
  quando o intervalo entre eles é pequeno.
- Linha `[HH:MM:SS] Nome: texto`, tempo relativo ao início da sessão.
- Cabeçalho com data, duração, lista de participantes.
- Entrega em `.md` e `.txt`; divide em partes se exceder limite de anexo do
  Discord.
- Apaga áudios brutos após entrega, exceto se `KEEP_AUDIO=true`.

## 9. Configuração (`.env`, validada com zod)

`DISCORD_TOKEN`, `DISCORD_CLIENT_ID`, `DISCORD_GUILD_ID` (opcional),
`TRANSCRIBER_PROVIDER` (padrão `openai`), `OPENAI_API_KEY`,
`TRANSCRIBE_MODEL`, `TRANSCRIBE_LANGUAGE`, `SILENCE_MS`, `MIN_SEGMENT_MS`,
`TRANSCRIBE_CONCURRENCY`, `MAX_SESSION_MINUTES`, `KEEP_AUDIO`, `DATA_DIR`,
`LOG_LEVEL`. App falha na inicialização com mensagem clara se a config for
inválida. `.env.example` commitado, sem segredos reais.

## 10. Estrutura de pastas

```
src/
  index.js
  config/env.js
  commands/
  core/
    session.js
    session-manager.js
    recorder.js
  services/
    transcriber/
      index.js
      openai.js
    formatter.js
    summarizer.js        # Fase 3
  utils/logger.js
scripts/
  spike-record.js        # Fase 0
  register-commands.js
tests/
```

## 11. Qualidade

Funções pequenas, DI simples (Transcriber injetado, não importado direto),
JSDoc em módulos/funções públicas, tratamento de erro centralizado sem
catch vazio, logs estruturados com `guildId`/`sessionId`, encerramento
gracioso em SIGINT/SIGTERM. Testes unitários: máquina de estados, formatter,
retry/concorrência de transcrição, validação de env.

## 12. Fases (execução sequencial, uma por vez, com aceite antes de avançar)

- **Fase 0 — spike** (`scripts/spike-record.js`): entra em canal, grava
  ~10s de um usuário, salva WAV. Aceite: WAV reproduzível, duração
  esperada, contém voz (verificado com ffprobe/análise de volume).
  **Regra de parada:** se áudio vazio/corrompido ou erro de DAVE, parar e
  reportar com logs completos — não avançar sem spike funcional ou
  aprovação do dono do projeto. Como a verificação exige uma call real com
  alguém falando, **quem executa e valida o spike é o dono do projeto**; o
  agente entrega o script e instruções, e aguarda o resultado antes de
  seguir para a Fase 1.
- **Fase 1 — esqueleto**: bootstrap, config, logger, registro de comandos,
  máquina de estados, `/start /pause /resume /status /mute-all /unmute-all`,
  testes da máquina de estados.
- **Fase 2 — núcleo**: segmentação por fala, `/finish /cancel`, transcrição
  com concorrência/retry, formatter, entrega do arquivo.
- **Fase 3 — acabamento**: `/summary`, `/vocab`, exportação refinada.
- **Fase 4 — robustez**: reconexão automática, `MAX_SESSION_MINUTES`,
  limpeza de sessões órfãs, Dockerfile, CI (lint + testes).

## 13. Consentimento e privacidade

Aviso de consentimento (mensagem no canal ao iniciar `/start`) e apagamento
de áudio ao final são requisitos obrigatórios, não opcionais.
