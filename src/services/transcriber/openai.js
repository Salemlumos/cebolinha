import { createReadStream, statSync } from 'node:fs';
import OpenAI from 'openai';

const OPENAI_FILE_LIMIT_BYTES = 25 * 1024 * 1024;

/**
 * Adaptador OpenAI (pago, requer `OPENAI_API_KEY`). Mantido atrás da mesma
 * interface `Transcriber` — troque `TRANSCRIBER_PROVIDER=openai` no `.env`
 * para usá-lo em vez do adaptador local gratuito.
 * @param {import('../../config/env.js').Env} env
 * @returns {import('./index.js').Transcriber}
 */
export function createOpenAiTranscriber(env) {
  const client = new OpenAI({ apiKey: env.OPENAI_API_KEY });

  return {
    async transcribe(filePath, { language = env.TRANSCRIBE_LANGUAGE } = {}) {
      const { size } = statSync(filePath);
      if (size > OPENAI_FILE_LIMIT_BYTES) {
        throw new Error(`Arquivo excede o limite de 25MB da API da OpenAI (${size} bytes): ${filePath}`);
      }

      const response = await client.audio.transcriptions.create({
        file: createReadStream(filePath),
        model: env.TRANSCRIBE_MODEL,
        language,
      });

      return { text: (response.text ?? '').trim() };
    },
  };
}
