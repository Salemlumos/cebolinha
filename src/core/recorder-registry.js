/**
 * Registro simples do recorder ativo por guild (um por vez, como as
 * sessões). Mantido separado do session-manager porque guarda um objeto de
 * I/O (streams, processos), não estado puro/testável.
 * @returns {{
 *   get(guildId: string): ReturnType<typeof import('./recorder.js').createRecorder> | undefined,
 *   set(guildId: string, recorder: ReturnType<typeof import('./recorder.js').createRecorder>): void,
 *   remove(guildId: string): void,
 * }}
 */
export function createRecorderRegistry() {
  const recorders = new Map();

  return {
    get(guildId) {
      return recorders.get(guildId);
    },
    set(guildId, recorder) {
      recorders.set(guildId, recorder);
    },
    remove(guildId) {
      recorders.delete(guildId);
    },
  };
}
