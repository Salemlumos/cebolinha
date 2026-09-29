import { createReadStream, statSync } from 'node:fs';
import OpenAI from 'openai';
import { createRateLimiter } from './rate-limiter.js';

const GROQ_BASE_URL = 'https://api.groq.com/openai/v1';
const GROQ_FILE_LIMIT_BYTES = 25 * 1024 * 1024;

/**
 * Adaptador Groq: mesmo modelo Whisper open-source, mas rodando no serviço
 * da Groq (LPU) em vez do seu servidor — grátis (tier gratuito, precisa de
 * conta em https://console.groq.com) e não consome CPU/RAM do servidor que
 * hospeda o bot. Usa o endpoint compatível com a API da OpenAI, então
 * reaproveita o mesmo SDK `openai` apontando para outra `baseURL`.
 *
 * O tier grátis da Groq limita a 20 requisições/minuto de Whisper — em
 * vez de descobrir isso via erro 429 (perdendo o segmento), espaçamos as
 * chamadas com um rate limiter (`env.TRANSCRIBE_RPM_LIMIT`, default 18,
 * uma margem de segurança abaixo do limite real).
 * @param {import('../../config/env.js').Env} env
 * @returns {import('./index.js').Transcriber}
 */
export function createGroqTranscriber(env) {
  const client = new OpenAI({ apiKey: env.GROQ_API_KEY, baseURL: GROQ_BASE_URL });
  const rateLimiter = createRateLimiter({ maxPerMinute: env.TRANSCRIBE_RPM_LIMIT });

  return {
    async transcribe(filePath, { language = env.TRANSCRIBE_LANGUAGE } = {}) {
      const { size } = statSync(filePath);
      if (size > GROQ_FILE_LIMIT_BYTES) {
        throw new Error(`Arquivo excede o limite de 25MB da API da Groq (${size} bytes): ${filePath}`);
      }

      await rateLimiter.acquire();

      const response = await client.audio.transcriptions.create({
        file: createReadStream(filePath),
        model: env.TRANSCRIBE_MODEL,
        language,
      });

      return { text: (response.text ?? '').trim() };
    },
  };
}
