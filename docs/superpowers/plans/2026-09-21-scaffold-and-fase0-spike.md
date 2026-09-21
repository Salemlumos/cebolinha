# Cebolinha — Scaffold + Fase 0 (spike de gravação) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Colocar o esqueleto de ferramentas do projeto `cebolinha` no ar (package.json, lint, testes, config de env, logger) e entregar `scripts/spike-record.js`, que prova — antes de qualquer outra fase — que o bot consegue entrar num canal de voz do Discord com `selfDeaf: false`, receber áudio de um usuário específico através do protocolo DAVE (via `@snazzah/davey`, empacotado dentro do `@discordjs/voice`) e gravar um WAV 16kHz mono que não é silêncio.

**Architecture:** Projeto Node ESM puro (`"type": "module"`). `src/config/env.js` expõe uma função pura `parseEnv(raw)` (fácil de testar) e uma `loadEnv(raw)` que sai do processo com mensagem clara se a config for inválida. `src/utils/logger.js` expõe `createLogger({ level })` sobre `pino`. `scripts/spike-record.js` é um script standalone (não reusa `core/recorder.js`, que só existe na Fase 2): ele conecta no Discord, assina o áudio Opus de um usuário via `@discordjs/voice`, decodifica com `prism-media`, resample com um processo `ffmpeg` (via `ffmpeg-static`) para WAV 16kHz mono, e roda uma análise de amplitude no arquivo resultante para provar programaticamente que não é silêncio — sem depender de `ffprobe` estar instalado no sistema.

**Tech Stack:** Node.js 24 (ESM), `discord.js@14.27.0`, `@discordjs/voice@0.19.2`, `@snazzah/davey@0.1.12`, `@discordjs/opus@0.10.0`, `prism-media@1.3.5`, `ffmpeg-static@5.3.0`, `zod@4.6.5`, `pino@10.3.1`, `vitest@5.0.1`, `eslint@10.11.0` + `@eslint/js@10.0.1` + `globals@17.12.0`, `prettier@3.9.8` + `eslint-config-prettier@10.1.8`.

**Spec:** `I:\dev\projets\cebolinha\docs\superpowers\specs\2026-09-21-cebolinha-design.md`

## Global Constraints

- Node.js 20+, ESM (`"type": "module"` no `package.json`). (spec §3)
- Sem TypeScript — JSDoc para tipos em módulos e funções públicas. (spec §11)
- `selfDeaf: false` é obrigatório ao entrar em canal de voz, senão não há recepção de áudio. (spec §2)
- Nenhum segredo commitado; `.env.example` sem valores reais. (spec §9)
- Se o áudio chegar vazio/corrompido ou houver erro de DAVE, o script deve **parar e reportar** com logs completos — nunca contornar em silêncio. (spec §12, Fase 0)
- Sem `catch` vazio; logs estruturados com contexto. (spec §11)
- Versões exatas fixadas em 2026-09-21 (ver Tech Stack acima) — usar exatamente essas, não `^`/`latest`, para reprodutibilidade do spike.

---

## Task 1: Scaffold do projeto (package.json, lint, prettier, vitest, .env.example, .gitignore)

**Files:**
- Create: `package.json`
- Create: `.gitignore`
- Create: `.env.example`
- Create: `eslint.config.js`
- Create: `.prettierrc.json`
- Create: `.prettierignore`
- Create: `README.md`

**Interfaces:**
- Produces: scripts `npm run lint`, `npm run format`, `npm test`, `npm run spike -- <channelId> <userId> [timeoutMs]` que as próximas tasks vão preencher de conteúdo.

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "cebolinha",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Bot de Discord que grava calls de voz e gera transcrição com identificação de falante.",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "start": "node src/index.js",
    "register-commands": "node scripts/register-commands.js",
    "spike": "node scripts/spike-record.js",
    "lint": "eslint .",
    "format": "prettier --write .",
    "test": "vitest run"
  },
  "dependencies": {
    "@discordjs/opus": "0.10.0",
    "@discordjs/voice": "0.19.2",
    "@snazzah/davey": "0.1.12",
    "discord.js": "14.27.0",
    "ffmpeg-static": "5.3.0",
    "openai": "7.20.0",
    "pino": "10.3.1",
    "prism-media": "1.3.5",
    "zod": "4.6.5"
  },
  "devDependencies": {
    "@eslint/js": "10.0.1",
    "eslint": "10.11.0",
    "eslint-config-prettier": "10.1.8",
    "globals": "17.12.0",
    "prettier": "3.9.8",
    "vitest": "5.0.1"
  }
}
```

- [ ] **Step 2: Criar `.gitignore`**

```
node_modules/
data/
.env
*.log
coverage/
.superpowers/
```

- [ ] **Step 3: Criar `.env.example`**

```
# Discord Developer Portal
DISCORD_TOKEN=
DISCORD_CLIENT_ID=
# Opcional: registra slash commands só nesse servidor (dev). Deixe vazio para registro global.
DISCORD_GUILD_ID=

# Transcrição
TRANSCRIBER_PROVIDER=openai
OPENAI_API_KEY=
TRANSCRIBE_MODEL=whisper-1
TRANSCRIBE_LANGUAGE=pt

# Captura de áudio
SILENCE_MS=1000
MIN_SEGMENT_MS=400
TRANSCRIBE_CONCURRENCY=3
MAX_SESSION_MINUTES=120
KEEP_AUDIO=false

# Infra
DATA_DIR=./data
LOG_LEVEL=info
```

- [ ] **Step 4: Criar `eslint.config.js`**

```js
import js from '@eslint/js';
import globals from 'globals';
import eslintConfigPrettier from 'eslint-config-prettier';

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: 'module',
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      'no-console': 'off',
    },
  },
  eslintConfigPrettier,
  {
    ignores: ['node_modules/', 'data/', 'coverage/'],
  },
];
```

- [ ] **Step 5: Criar `.prettierrc.json` e `.prettierignore`**

`.prettierrc.json`:
```json
{
  "singleQuote": true,
  "semi": true,
  "printWidth": 100,
  "trailingComma": "all"
}
```

`.prettierignore`:
```
node_modules/
data/
coverage/
```

- [ ] **Step 6: Criar `README.md` (esqueleto, será completado na Task 5)**

```markdown
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

\`\`\`bash
npm install
cp .env.example .env
# edite .env com o token e client id da sua aplicação
\`\`\`
```

- [ ] **Step 7: Instalar dependências**

Run: `npm install`
Expected: `node_modules/` criado, `package-lock.json` gerado, sem erros.

- [ ] **Step 8: Verificar lint roda (sem arquivos-fonte ainda, deve passar vazio)**

Run: `npm run lint`
Expected: sai com código 0 (nenhum arquivo `.js` fora de `node_modules` ainda existe para lintar, exceto `eslint.config.js` — ele mesmo deve passar limpo).

- [ ] **Step 9: Commit**

```bash
git add package.json package-lock.json .gitignore .env.example eslint.config.js .prettierrc.json .prettierignore README.md
git commit -m "chore: scaffold project tooling (npm, eslint, prettier, vitest)

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 2: `src/config/env.js` — validação de variáveis de ambiente com zod

**Files:**
- Create: `src/config/env.js`
- Test: `tests/config/env.test.js`

**Interfaces:**
- Produces:
  - `parseEnv(raw: Record<string,string|undefined>) → { success: true, data: Env } | { success: false, error: import('zod').ZodError }`
  - `loadEnv(raw = process.env) → Env` (sai do processo com `console.error` + `process.exit(1)` se inválido)
  - `Env` shape: `{ DISCORD_TOKEN, DISCORD_CLIENT_ID, DISCORD_GUILD_ID?, TRANSCRIBER_PROVIDER, OPENAI_API_KEY?, TRANSCRIBE_MODEL, TRANSCRIBE_LANGUAGE, SILENCE_MS, MIN_SEGMENT_MS, TRANSCRIBE_CONCURRENCY, MAX_SESSION_MINUTES, KEEP_AUDIO, DATA_DIR, LOG_LEVEL }`
- Consumes: nada (primeira peça do app).

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/config/env.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

const baseValidEnv = {
  DISCORD_TOKEN: 'token-123',
  DISCORD_CLIENT_ID: 'client-123',
};

describe('parseEnv', () => {
  it('aceita a config mínima válida e aplica defaults', () => {
    const result = parseEnv(baseValidEnv);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      DISCORD_TOKEN: 'token-123',
      DISCORD_CLIENT_ID: 'client-123',
      TRANSCRIBER_PROVIDER: 'openai',
      TRANSCRIBE_MODEL: 'whisper-1',
      TRANSCRIBE_LANGUAGE: 'pt',
      SILENCE_MS: 1000,
      MIN_SEGMENT_MS: 400,
      TRANSCRIBE_CONCURRENCY: 3,
      MAX_SESSION_MINUTES: 120,
      KEEP_AUDIO: false,
      DATA_DIR: './data',
      LOG_LEVEL: 'info',
    });
  });

  it('rejeita quando falta DISCORD_TOKEN', () => {
    const result = parseEnv({ DISCORD_CLIENT_ID: 'client-123' });
    expect(result.success).toBe(false);
    const paths = result.error.issues.map((issue) => issue.path.join('.'));
    expect(paths).toContain('DISCORD_TOKEN');
  });

  it('rejeita TRANSCRIBER_PROVIDER=openai sem OPENAI_API_KEY', () => {
    const result = parseEnv({ ...baseValidEnv, TRANSCRIBER_PROVIDER: 'openai' });
    expect(result.success).toBe(false);
    const paths = result.error.issues.map((issue) => issue.path.join('.'));
    expect(paths).toContain('OPENAI_API_KEY');
  });

  it('aceita OPENAI_API_KEY quando presente', () => {
    const result = parseEnv({ ...baseValidEnv, OPENAI_API_KEY: 'sk-abc' });
    expect(result.success).toBe(true);
  });

  it('converte KEEP_AUDIO="true" em booleano true', () => {
    const result = parseEnv({ ...baseValidEnv, OPENAI_API_KEY: 'sk-abc', KEEP_AUDIO: 'true' });
    expect(result.success).toBe(true);
    expect(result.data.KEEP_AUDIO).toBe(true);
  });

  it('coage SILENCE_MS numérico a partir de string', () => {
    const result = parseEnv({ ...baseValidEnv, OPENAI_API_KEY: 'sk-abc', SILENCE_MS: '1500' });
    expect(result.success).toBe(true);
    expect(result.data.SILENCE_MS).toBe(1500);
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/config/env.test.js`
Expected: FAIL — `Cannot find module '../../src/config/env.js'` (o arquivo ainda não existe).

- [ ] **Step 3: Implementar `src/config/env.js`**

```js
import { z } from 'zod';

/**
 * @typedef {Object} Env
 * @property {string} DISCORD_TOKEN
 * @property {string} DISCORD_CLIENT_ID
 * @property {string} [DISCORD_GUILD_ID]
 * @property {'openai'} TRANSCRIBER_PROVIDER
 * @property {string} [OPENAI_API_KEY]
 * @property {string} TRANSCRIBE_MODEL
 * @property {string} TRANSCRIBE_LANGUAGE
 * @property {number} SILENCE_MS
 * @property {number} MIN_SEGMENT_MS
 * @property {number} TRANSCRIBE_CONCURRENCY
 * @property {number} MAX_SESSION_MINUTES
 * @property {boolean} KEEP_AUDIO
 * @property {string} DATA_DIR
 * @property {'fatal'|'error'|'warn'|'info'|'debug'|'trace'} LOG_LEVEL
 */

const envSchema = z
  .object({
    DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN é obrigatório'),
    DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID é obrigatório'),
    DISCORD_GUILD_ID: z.string().min(1).optional(),
    TRANSCRIBER_PROVIDER: z.enum(['openai']).default('openai'),
    OPENAI_API_KEY: z.string().min(1).optional(),
    TRANSCRIBE_MODEL: z.string().min(1).default('whisper-1'),
    TRANSCRIBE_LANGUAGE: z.string().min(1).default('pt'),
    SILENCE_MS: z.coerce.number().int().positive().default(1000),
    MIN_SEGMENT_MS: z.coerce.number().int().positive().default(400),
    TRANSCRIBE_CONCURRENCY: z.coerce.number().int().positive().default(3),
    MAX_SESSION_MINUTES: z.coerce.number().int().positive().default(120),
    KEEP_AUDIO: z
      .string()
      .optional()
      .default('false')
      .transform((value) => value === 'true'),
    DATA_DIR: z.string().min(1).default('./data'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
  })
  .superRefine((data, ctx) => {
    if (data.TRANSCRIBER_PROVIDER === 'openai' && !data.OPENAI_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OPENAI_API_KEY'],
        message: 'OPENAI_API_KEY é obrigatório quando TRANSCRIBER_PROVIDER=openai',
      });
    }
  });

/**
 * Valida variáveis de ambiente brutas sem efeitos colaterais.
 * @param {Record<string, string|undefined>} raw
 * @returns {{ success: true, data: Env } | { success: false, error: import('zod').ZodError }}
 */
export function parseEnv(raw) {
  const result = envSchema.safeParse(raw);
  if (!result.success) {
    return { success: false, error: result.error };
  }
  return { success: true, data: result.data };
}

/**
 * Carrega e valida a configuração do processo atual. Encerra o processo com
 * mensagem clara se a configuração for inválida — chame apenas no bootstrap
 * (index.js / scripts), nunca em código testável.
 * @param {Record<string, string|undefined>} [raw]
 * @returns {Env}
 */
export function loadEnv(raw = process.env) {
  const result = parseEnv(raw);
  if (!result.success) {
    const details = result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`);
    console.error('Configuração inválida. Corrija o arquivo .env:');
    for (const detail of details) {
      console.error(`  - ${detail}`);
    }
    process.exit(1);
  }
  return result.data;
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/config/env.test.js`
Expected: PASS — 6 testes verdes.

- [ ] **Step 5: Lint**

Run: `npm run lint`
Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
git add src/config/env.js tests/config/env.test.js
git commit -m "feat: add env validation with zod

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 3: `src/utils/logger.js` — logger estruturado com pino

**Files:**
- Create: `src/utils/logger.js`
- Test: `tests/utils/logger.test.js`

**Interfaces:**
- Consumes: nada além de `pino` (npm).
- Produces: `createLogger({ level }: { level?: string }) → import('pino').Logger`. Usado por `scripts/spike-record.js` (Task 4) e por todo o resto do app nas fases futuras via `logger.child({ guildId, sessionId })`.

- [ ] **Step 1: Escrever o teste que falha**

Create `tests/utils/logger.test.js`:

```js
import { describe, it, expect } from 'vitest';
import { createLogger } from '../../src/utils/logger.js';

describe('createLogger', () => {
  it('usa nível "info" por padrão', () => {
    const logger = createLogger();
    expect(logger.level).toBe('info');
  });

  it('respeita o nível informado', () => {
    const logger = createLogger({ level: 'debug' });
    expect(logger.level).toBe('debug');
  });

  it('permite criar logger filho com contexto', () => {
    const logger = createLogger({ level: 'info' });
    const child = logger.child({ guildId: 'guild-1' });
    expect(typeof child.info).toBe('function');
    expect(typeof child.error).toBe('function');
  });
});
```

- [ ] **Step 2: Rodar o teste e confirmar que falha**

Run: `npx vitest run tests/utils/logger.test.js`
Expected: FAIL — `Cannot find module '../../src/utils/logger.js'`.

- [ ] **Step 3: Implementar `src/utils/logger.js`**

```js
import pino from 'pino';

/**
 * Cria um logger estruturado (pino). Cada guild/sessão deve derivar um
 * logger filho com `.child({ guildId, sessionId })` para carregar contexto
 * em todas as linhas.
 * @param {Object} [options]
 * @param {string} [options.level='info']
 * @returns {import('pino').Logger}
 */
export function createLogger({ level = 'info' } = {}) {
  return pino({
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
  });
}
```

- [ ] **Step 4: Rodar o teste e confirmar que passa**

Run: `npx vitest run tests/utils/logger.test.js`
Expected: PASS — 3 testes verdes.

- [ ] **Step 5: Lint e commit**

Run: `npm run lint`
Expected: sem erros.

```bash
git add src/utils/logger.js tests/utils/logger.test.js
git commit -m "feat: add pino-based structured logger factory

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 4: `scripts/spike-record.js` — Fase 0, spike de gravação real

**Files:**
- Create: `scripts/spike-record.js`

**Interfaces:**
- Consumes: `loadEnv` e `createLogger` (Tasks 2 e 3).
- Produces: nenhuma interface reusada por outro código — é um script standalone executado manualmente pelo dono do projeto. Não tem teste automatizado (depende de uma call real do Discord); a verificação é a execução manual descrita no Step 5 e documentada no README (Task 5).

Este script não é testável por unidade — ele depende de uma conexão de voz
real do Discord e de uma pessoa falando. Por isso não há passo de "escrever
teste que falha" aqui; a validação é a execução real descrita no Step 5.

- [ ] **Step 1: Escrever `scripts/spike-record.js`**

```js
#!/usr/bin/env node
/**
 * Fase 0 — spike técnico.
 *
 * Entra em um canal de voz, aguarda um usuário específico começar a falar,
 * grava essa fala (decodificando Opus -> PCM -> WAV 16kHz mono) e roda uma
 * análise de amplitude no arquivo resultante para provar programaticamente
 * que o áudio recebido não é silêncio/corrompido.
 *
 * Uso:
 *   node scripts/spike-record.js <voiceChannelId> <targetUserId> [timeoutMs]
 *
 * Regra de parada: se o áudio chegar vazio, corrompido, ou houver erro de
 * decriptografia/DAVE, o script sai com código 1 e imprime um diagnóstico
 * completo (versões instaladas, estado da conexão, contagem de pacotes
 * Opus recebidos). Não avance para a Fase 1 sem ver "SPIKE PASSOU" aqui.
 */
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus, EndBehaviorType, entersState } from '@discordjs/voice';
import prism from 'prism-media';
import ffmpegPath from 'ffmpeg-static';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/utils/logger.js';

const require = createRequire(import.meta.url);

const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_PEAK_AMPLITUDE = 500; // de 32767 (int16) — abaixo disso tratamos como silêncio

function getPackageVersion(pkgName) {
  try {
    return require(`${pkgName}/package.json`).version;
  } catch {
    return 'desconhecida';
  }
}

function logVersions(logger) {
  logger.info(
    {
      node: process.version,
      'discord.js': getPackageVersion('discord.js'),
      '@discordjs/voice': getPackageVersion('@discordjs/voice'),
      '@snazzah/davey': getPackageVersion('@snazzah/davey'),
      'prism-media': getPackageVersion('prism-media'),
    },
    'Versões instaladas',
  );
}

/**
 * Lê um WAV PCM16 canônico (cabeçalho de 44 bytes escrito pelo ffmpeg) e
 * calcula pico e RMS das amostras, para provar que o áudio não é silêncio.
 * @param {string} filePath
 * @returns {{ durationSeconds: number, peakAmplitude: number, rms: number, sampleRate: number }}
 */
function analyzeWav(filePath) {
  const buffer = readFileSync(filePath);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Arquivo não é um WAV RIFF válido');
  }
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  if (bitsPerSample !== 16) {
    throw new Error(`Esperado PCM16, encontrado ${bitsPerSample} bits por amostra`);
  }
  const dataStart = 44;
  const dataBytes = buffer.length - dataStart;
  const sampleCount = Math.floor(dataBytes / 2);

  let peak = 0;
  let sumSquares = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    const sample = buffer.readInt16LE(dataStart + i * 2);
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
    sumSquares += sample * sample;
  }
  const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
  const durationSeconds = sampleCount / sampleRate;

  return { durationSeconds, peakAmplitude: peak, rms, sampleRate };
}

/**
 * Decodifica o stream Opus de um usuário e grava um WAV 16kHz mono via ffmpeg.
 * @param {import('@discordjs/voice').VoiceReceiver} receiver
 * @param {string} userId
 * @param {string} outputPath
 * @param {number} silenceMs
 * @param {import('pino').Logger} logger
 * @returns {Promise<{ packetCount: number }>}
 */
function recordUserToWav(receiver, userId, outputPath, silenceMs, logger) {
  return new Promise((resolve, reject) => {
    const opusStream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: silenceMs },
    });
    const decoder = new prism.opus.Decoder({ rate: 48_000, channels: 2, frameSize: 960 });

    let packetCount = 0;
    opusStream.on('data', () => {
      packetCount += 1;
    });

    const ffmpeg = spawn(ffmpegPath, [
      '-y',
      '-f',
      's16le',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-i',
      'pipe:0',
      '-ar',
      '16000',
      '-ac',
      '1',
      outputPath,
    ]);

    let ffmpegStderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      ffmpegStderr += chunk.toString();
    });

    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      logger.error({ err: err.message, ffmpegStderr }, 'Falha ao gravar/decodificar áudio');
      reject(err);
    };

    opusStream.on('error', (err) => fail(new Error(`opusStream: ${err.message}`)));
    decoder.on('error', (err) => fail(new Error(`decoder: ${err.message}`)));
    ffmpeg.on('error', (err) => fail(new Error(`ffmpeg: ${err.message}`)));

    ffmpeg.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (code !== 0) {
        reject(new Error(`ffmpeg saiu com código ${code}: ${ffmpegStderr}`));
        return;
      }
      resolve({ packetCount });
    });

    opusStream.pipe(decoder).pipe(ffmpeg.stdin);
  });
}

async function main() {
  const env = loadEnv();
  const logger = createLogger({ level: env.LOG_LEVEL });
  logVersions(logger);

  const [channelId, targetUserId, timeoutArg] = process.argv.slice(2);
  const timeoutMs = Number(timeoutArg) || DEFAULT_TIMEOUT_MS;

  if (!channelId || !targetUserId) {
    logger.error(
      'Uso: node scripts/spike-record.js <voiceChannelId> <targetUserId> [timeoutMs]',
    );
    process.exit(1);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  const cleanupAndExit = async (connection, code) => {
    try {
      connection?.destroy();
    } catch {
      // conexão já pode estar destruída; seguir para sair do processo.
    }
    client.destroy();
    process.exit(code);
  };

  client.once('ready', async () => {
    logger.info({ user: client.user.tag }, 'Bot logado');

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isVoiceBased()) {
      logger.error({ channelId }, 'Canal de voz não encontrado ou inválido');
      await cleanupAndExit(null, 1);
      return;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    process.once('SIGINT', () => cleanupAndExit(connection, 130));

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    } catch (err) {
      logger.error(
        { err: err.message },
        'Conexão de voz não ficou pronta a tempo — possível problema de rede/permissões',
      );
      await cleanupAndExit(connection, 1);
      return;
    }

    logger.info(
      { targetUserId, timeoutMs },
      `Conectado. Fale continuamente por ~10s no canal — aguardando até ${timeoutMs}ms.`,
    );

    let handled = false;
    const timeout = setTimeout(async () => {
      if (handled) return;
      handled = true;
      logger.error(
        { targetUserId, timeoutMs },
        'SPIKE FALHOU: nenhuma fala detectada do usuário alvo dentro do tempo limite',
      );
      await cleanupAndExit(connection, 1);
    }, timeoutMs);

    connection.receiver.speaking.on('start', async (userId) => {
      if (handled || userId !== targetUserId) return;
      handled = true;
      clearTimeout(timeout);

      mkdirSync(join(env.DATA_DIR, 'spike'), { recursive: true });
      const outputPath = join(env.DATA_DIR, 'spike', `${Date.now()}_${userId}.wav`);
      logger.info({ outputPath }, 'Fala detectada, gravando...');

      try {
        const { packetCount } = await recordUserToWav(
          connection.receiver,
          userId,
          outputPath,
          env.SILENCE_MS,
          logger,
        );
        const analysis = analyzeWav(outputPath);
        logger.info({ packetCount, outputPath, ...analysis }, 'Gravação concluída, análise de amplitude');

        if (packetCount === 0) {
          logger.error(
            'SPIKE FALHOU: zero pacotes Opus recebidos — verifique selfDeaf=false, permissões do bot e versões de @discordjs/voice/@snazzah/davey listadas acima (possível falha de handshake DAVE).',
          );
          await cleanupAndExit(connection, 1);
          return;
        }

        if (analysis.peakAmplitude < MIN_PEAK_AMPLITUDE) {
          logger.error(
            { peakAmplitude: analysis.peakAmplitude, threshold: MIN_PEAK_AMPLITUDE },
            'SPIKE FALHOU: áudio decodificado é essencialmente silêncio — possível falha de decriptografia DAVE ou decodificação Opus. Reporte este log completo antes de avançar.',
          );
          await cleanupAndExit(connection, 1);
          return;
        }

        logger.info(
          { outputPath, ...analysis },
          'SPIKE PASSOU: WAV gravado, contém áudio (não silêncio). Confirme ouvindo o arquivo.',
        );
        await cleanupAndExit(connection, 0);
      } catch (err) {
        logger.error({ err: err.message }, 'SPIKE FALHOU: erro durante gravação/decodificação');
        await cleanupAndExit(connection, 1);
      }
    });
  });

  await client.login(env.DISCORD_TOKEN);
}

main().catch((err) => {
  console.error('Erro fatal no spike:', err);
  process.exit(1);
});
```

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: sem erros (ajustar imports não usados se o eslint reclamar).

- [ ] **Step 3: Execução manual real (feita pelo dono do projeto, não pelo agente)**

Pré-requisitos que só o dono do projeto tem: `.env` preenchido com `DISCORD_TOKEN`/`DISCORD_CLIENT_ID` reais, o bot convidado para um servidor de teste com permissão `Connect`, e uma pessoa disponível para falar no canal.

Run:
```bash
node scripts/spike-record.js <ID_DO_CANAL_DE_VOZ> <ID_DO_USUARIO_ALVO>
```

Depois, com o bot já conectado (log "Conectado. Fale continuamente..."), a pessoa identificada por `<ID_DO_USUARIO_ALVO>` fala continuamente por ~10 segundos.

Expected: log final `SPIKE PASSOU: WAV gravado...` com `peakAmplitude` bem acima de 500 e `durationSeconds` próximo de quanto tempo a pessoa falou; arquivo em `data/spike/<timestamp>_<userId>.wav` reproduzível em qualquer player.

Se sair `SPIKE FALHOU`, **pare** — copie o log completo (inclui as versões instaladas) e reporte antes de prosseguir para a Task 5/Fase 1, conforme a regra de parada da spec.

- [ ] **Step 4: Commit**

```bash
git add scripts/spike-record.js
git commit -m "feat: add fase 0 voice recording spike script

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Task 5: README — como configurar o Developer Portal e rodar o spike

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: nada.
- Produces: nada consumido por código; é a documentação que o dono do projeto segue para executar a Task 4 / Step 3.

- [ ] **Step 1: Completar `README.md` com a seção de setup do Developer Portal e execução do spike**

Adicionar ao final do `README.md` (depois da seção "Instalação" já criada na Task 1):

```markdown
## Configurar a aplicação no Discord Developer Portal

1. Acesse https://discord.com/developers/applications e crie (ou reuse) uma aplicação.
2. Em **Bot**, copie o token para `DISCORD_TOKEN` no `.env`, e o **Application ID** (na aba **General Information**) para `DISCORD_CLIENT_ID`.
3. Em **Bot**, habilite os intents privilegiados: **Guilds** e **Server Members Intent** não são necessários; habilite especificamente **Guild Voice States** (via os intents `Guilds` e `GuildVoiceStates`, já configurados no código).
4. Em **OAuth2 > URL Generator**, marque os scopes `bot` e `applications.commands`, e as permissões `Connect`, `Mute Members`, `Send Messages`, `Attach Files`.
5. Copie a URL gerada e use-a para convidar o bot ao seu servidor de teste.

## Rodando a Fase 0 (spike de gravação)

Antes de qualquer outra funcionalidade, valide que a recepção de áudio e a
criptografia DAVE funcionam no seu ambiente:

\`\`\`bash
npm install
cp .env.example .env   # preencha DISCORD_TOKEN e DISCORD_CLIENT_ID
node scripts/spike-record.js <ID_DO_CANAL_DE_VOZ> <ID_DO_USUARIO_ALVO>
\`\`\`

Para pegar o ID do canal de voz e do usuário: ative o **Modo Desenvolvedor**
em Configurações do Discord > Avançado, depois clique com o botão direito no
canal/usuário e escolha "Copiar ID".

Depois de ver a mensagem "Conectado. Fale continuamente...", a pessoa cujo ID
foi informado deve falar por ~10 segundos. O script sai sozinho com:

- `SPIKE PASSOU`: gravou um WAV em `data/spike/` com áudio real (não silêncio). Abra o arquivo em qualquer player para confirmar.
- `SPIKE FALHOU`: pare e reporte o log completo (ele inclui as versões instaladas do discord.js/@discordjs/voice/@snazzah/davey) antes de avançar para a próxima fase.

## Testes

\`\`\`bash
npm test
\`\`\`

## Consentimento e privacidade

Este bot grava voz de pessoas reais. Ao usar `/start` (Fase 1), o bot deve
avisar explicitamente no canal de texto que a gravação começou — nunca grave
sem esse aviso.
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: document developer portal setup and fase 0 spike usage

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Fim da Fase 0

Depois deste plano executado, **pare**: a Fase 1 (esqueleto de comandos e
máquina de estados) só deve começar depois que o dono do projeto rodar a
Task 4/Step 3 manualmente e confirmar `SPIKE PASSOU`, ou aprovar
explicitamente avançar sem isso.
