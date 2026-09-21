import { createLocalTranscriber } from './local.js';
import { createOpenAiTranscriber } from './openai.js';
import { createGroqTranscriber } from './groq.js';

/**
 * @typedef {Object} TranscribeOptions
 * @property {string} [language]
 * @property {string[]} [vocabulary]
 *
 * @typedef {Object} Transcriber
 * @property {(filePath: string, options?: TranscribeOptions) => Promise<{ text: string }>} transcribe
 */

/**
 * Fábrica do transcritor configurado via env. A interface é a mesma para
 * qualquer provedor — um adaptador local (whisper.cpp/faster-whisper) pode
 * ser adicionado aqui no futuro sem tocar em quem consome `Transcriber`.
 * @param {import('../../config/env.js').Env} env
 * @returns {Transcriber}
 */
export function createTranscriber(env) {
  if (env.TRANSCRIBER_PROVIDER === 'openai') {
    if (!env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY é obrigatório quando TRANSCRIBER_PROVIDER=openai');
    }
    return createOpenAiTranscriber(env);
  }
  if (env.TRANSCRIBER_PROVIDER === 'groq') {
    if (!env.GROQ_API_KEY) {
      throw new Error('GROQ_API_KEY é obrigatório quando TRANSCRIBER_PROVIDER=groq');
    }
    return createGroqTranscriber(env);
  }
  return createLocalTranscriber(env);
}
