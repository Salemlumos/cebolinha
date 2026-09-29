const DEFAULT_RETRIES = 3;
const DEFAULT_BASE_DELAY_MS = 500;
const DEFAULT_FALLBACK_TEXT = '[trecho não transcrito]';

function realSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry(fn, { retries, baseDelayMs, sleepFn }) {
  let lastErr;
  for (let attempt = 0; attempt <= retries; attempt += 1) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < retries) {
        await sleepFn(baseDelayMs * 2 ** attempt);
      }
    }
  }
  throw lastErr;
}

/**
 * Transcreve vários segmentos com concorrência limitada e retry com
 * backoff exponencial em falhas transitórias. Nunca lança: um segmento que
 * falha em todas as tentativas recebe `fallbackText`, para que `/finish`
 * sempre consiga concluir (spec §6).
 * @param {import('./index.js').Transcriber} transcriber
 * @param {Array<{ filePath: string } & Record<string, unknown>>} segments
 * @param {Object} [options]
 * @param {number} [options.concurrency]
 * @param {string} [options.language]
 * @param {string[]} [options.vocabulary]
 * @param {string} [options.fallbackText]
 * @param {number} [options.retries]
 * @param {number} [options.baseDelayMs]
 * @param {(ms: number) => Promise<void>} [options.sleepFn]
 * @param {import('pino').Logger} [options.logger] Loga o motivo real de
 *   cada segmento que esgota as tentativas — sem isso, a causa (rate
 *   limit, rede, etc.) fica invisível por trás do `fallbackText`.
 * @returns {Promise<Array<Record<string, unknown> & { text: string }>>}
 */
export async function transcribeSegments(
  transcriber,
  segments,
  {
    concurrency = 3,
    language,
    vocabulary,
    fallbackText = DEFAULT_FALLBACK_TEXT,
    retries = DEFAULT_RETRIES,
    baseDelayMs = DEFAULT_BASE_DELAY_MS,
    sleepFn = realSleep,
    logger,
  } = {},
) {
  const results = new Array(segments.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < segments.length) {
      const index = nextIndex;
      nextIndex += 1;
      const segment = segments[index];
      try {
        const { text } = await withRetry(
          () => transcriber.transcribe(segment.filePath, { language, vocabulary }),
          { retries, baseDelayMs, sleepFn },
        );
        results[index] = { ...segment, text };
      } catch (err) {
        logger?.error(
          { err: err.message, filePath: segment.filePath, userId: segment.userId },
          'Segmento esgotou as tentativas de transcrição, usando texto de fallback',
        );
        results[index] = { ...segment, text: fallbackText };
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, segments.length));
  await Promise.all(Array.from({ length: workerCount }, worker));
  return results;
}
