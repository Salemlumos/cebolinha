import pino from 'pino';

/**
 * Cria um logger estruturado (pino). Cada guild/sessão deve derivar um
 * logger filho com `.child({ guildId, sessionId })` para carregar contexto
 * em todas as linhas.
 * @param {Object} [options]
 * @param {string} [options.level='info']
 * @param {boolean} [options.pretty=false] Formata as linhas pra leitura
 *   humana (cores, timestamp curto) em vez de JSON bruto. Use só em
 *   desenvolvimento — em produção prefira JSON puro (mais fácil de agregar
 *   em ferramentas de log).
 * @returns {import('pino').Logger}
 */
export function createLogger({ level = 'info', pretty = false } = {}) {
  return pino({
    level,
    timestamp: pino.stdTimeFunctions.isoTime,
    ...(pretty && {
      transport: {
        target: 'pino-pretty',
        options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
      },
    }),
  });
}
