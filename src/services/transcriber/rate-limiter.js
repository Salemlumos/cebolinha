/**
 * Limitador de taxa por janela fixa: espaça chamadas pra nunca exceder
 * `maxPerMinute`, em vez de descobrir o limite via erro 429 e tentar de
 * novo depois (a Groq usa 20 req/min no tier grátis para Whisper — errar
 * por tentativa e erro custa segmentos inteiros da transcrição).
 * @param {Object} params
 * @param {number} params.maxPerMinute
 * @param {(ms: number) => Promise<void>} [params.sleepFn]
 * @param {() => number} [params.now]
 * @returns {{ acquire(): Promise<void> }}
 */
export function createRateLimiter({
  maxPerMinute,
  sleepFn = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  now = () => Date.now(),
}) {
  const minIntervalMs = 60_000 / maxPerMinute;
  let nextAvailableAt = 0;

  async function acquire() {
    const currentTime = now();
    const scheduledAt = Math.max(currentTime, nextAvailableAt);
    nextAvailableAt = scheduledAt + minIntervalMs;
    const waitMs = scheduledAt - currentTime;
    if (waitMs > 0) {
      await sleepFn(waitMs);
    }
  }

  return { acquire };
}
