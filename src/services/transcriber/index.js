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
 * Fábrica do transcritor. Único provedor: Groq (grátis, roda fora do
 * servidor do bot). A interface `Transcriber` continua isolada de quem a
 * consome, então trocar/adicionar provedor no futuro não exige tocar em
 * `run-batch.js` nem nos comandos.
 * @param {import('../../config/env.js').Env} env
 * @returns {Transcriber}
 */
export function createTranscriber(env) {
  return createGroqTranscriber(env);
}
