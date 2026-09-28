/**
 * Alias interno do bot por usuário/guild, usado na transcrição e no
 * `/c-status` no lugar do nome de exibição do Discord. Não é o nickname
 * real do servidor — fica só em memória (sem persistência em disco/DB,
 * fora de escopo do projeto).
 * @returns {{
 *   get(guildId: string, userId: string): string | undefined,
 *   set(guildId: string, userId: string, alias: string): void,
 *   remove(guildId: string, userId: string): void,
 * }}
 */
export function createNicknameStore() {
  const aliasesByGuild = new Map();

  function get(guildId, userId) {
    return aliasesByGuild.get(guildId)?.get(userId);
  }

  function set(guildId, userId, alias) {
    if (!aliasesByGuild.has(guildId)) {
      aliasesByGuild.set(guildId, new Map());
    }
    aliasesByGuild.get(guildId).set(userId, alias);
  }

  function remove(guildId, userId) {
    aliasesByGuild.get(guildId)?.delete(userId);
  }

  return { get, set, remove };
}
