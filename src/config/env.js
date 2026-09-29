import { z } from 'zod';

/**
 * @typedef {Object} Env
 * @property {string} DISCORD_TOKEN
 * @property {string} DISCORD_CLIENT_ID
 * @property {string} [DISCORD_GUILD_ID]
 * @property {string} GROQ_API_KEY
 * @property {string} TRANSCRIBE_MODEL
 * @property {string} TRANSCRIBE_LANGUAGE
 * @property {number} SILENCE_MS
 * @property {number} MIN_SEGMENT_MS
 * @property {number} TRANSCRIBE_CONCURRENCY
 * @property {number} TRANSCRIBE_RPM_LIMIT
 * @property {number} MAX_SESSION_MINUTES
 * @property {boolean} KEEP_AUDIO
 * @property {string} DATA_DIR
 * @property {'fatal'|'error'|'warn'|'info'|'debug'|'trace'} LOG_LEVEL
 * @property {number} EMPTY_CHANNEL_TIMEOUT_MS
 * @property {'finish'|'cancel'} EMPTY_CHANNEL_POLICY
 */

const envSchema = z
  .object({
    DISCORD_TOKEN: z.string().min(1, 'DISCORD_TOKEN é obrigatório'),
    DISCORD_CLIENT_ID: z.string().min(1, 'DISCORD_CLIENT_ID é obrigatório'),
    DISCORD_GUILD_ID: z
      .string()
      .optional()
      .transform((value) => value || undefined),
    // Único provedor de transcrição: Groq (grátis, roda fora do servidor
    // do bot). Crie uma chave grátis em https://console.groq.com/keys
    GROQ_API_KEY: z.string().min(1, 'GROQ_API_KEY é obrigatório (crie uma chave grátis em https://console.groq.com/keys)'),
    TRANSCRIBE_MODEL: z.string().min(1).default('whisper-large-v3-turbo'),
    TRANSCRIBE_LANGUAGE: z.string().min(1).default('pt'),
    SILENCE_MS: z.coerce.number().int().positive().default(1000),
    MIN_SEGMENT_MS: z.coerce.number().int().positive().default(400),
    TRANSCRIBE_CONCURRENCY: z.coerce.number().int().positive().default(3),
    // Tier grátis da Groq: 20 req/min pra Whisper. 18 é uma margem de
    // segurança — suba se estiver num plano pago com limite maior.
    TRANSCRIBE_RPM_LIMIT: z.coerce.number().int().positive().default(18),
    MAX_SESSION_MINUTES: z.coerce.number().int().positive().default(120),
    KEEP_AUDIO: z
      .string()
      .optional()
      .default('false')
      .transform((value) => value === 'true'),
    DATA_DIR: z.string().min(1).default('./data'),
    LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace']).default('info'),
    // Fail-safe: desconecta o bot se ficar sozinho num canal por esse
    // tempo. EMPTY_CHANNEL_POLICY decide o que fazer com gravação ativa.
    EMPTY_CHANNEL_TIMEOUT_MS: z.coerce.number().int().positive().default(300_000),
    EMPTY_CHANNEL_POLICY: z.enum(['finish', 'cancel']).default('finish'),
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
 * Carrega e valida a configuração do processo atual. Lê `.env` (via a API
 * nativa do Node, sem dependência extra) antes de validar, e encerra o
 * processo com mensagem clara se a configuração for inválida — chame apenas
 * no bootstrap (index.js / scripts), nunca em código testável.
 * @param {Record<string, string|undefined>} [raw]
 * @returns {Env}
 */
export function loadEnv(raw = process.env) {
  try {
    process.loadEnvFile();
  } catch (err) {
    if (err.code !== 'ENOENT') throw err;
  }
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
