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
