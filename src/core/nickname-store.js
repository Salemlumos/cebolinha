import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * Alias interno do bot por usuário/guild, usado na transcrição e no
 * `/c-status` no lugar do nome de exibição do Discord. Não é o nickname
 * real do servidor. Persiste num arquivo JSON simples (sem DB — continua
 * fora de escopo), pra sobreviver a reinícios do bot: sem isso, um
 * restart apagava todos os apelidos e a próxima transcrição voltava a
 * usar o nome do Discord, o que pareceu um bug pra quem estava usando.
 * @param {string} [filePath] Se omitido, fica só em memória (usado nos
 *   testes, por exemplo).
 * @returns {{
 *   get(guildId: string, userId: string): string | undefined,
 *   set(guildId: string, userId: string, alias: string): void,
 *   remove(guildId: string, userId: string): void,
 * }}
 */
export function createNicknameStore(filePath) {
  const aliasesByGuild = new Map();

  if (filePath) {
    try {
      const raw = JSON.parse(readFileSync(filePath, 'utf8'));
      for (const [guildId, users] of Object.entries(raw)) {
        aliasesByGuild.set(guildId, new Map(Object.entries(users)));
      }
    } catch (err) {
      if (err.code !== 'ENOENT') throw err;
    }
  }

  function persist() {
    if (!filePath) return;
    const plain = {};
    for (const [guildId, users] of aliasesByGuild) {
      plain[guildId] = Object.fromEntries(users);
    }
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, JSON.stringify(plain, null, 2));
  }

  function get(guildId, userId) {
    return aliasesByGuild.get(guildId)?.get(userId);
  }

  function set(guildId, userId, alias) {
    if (!aliasesByGuild.has(guildId)) {
      aliasesByGuild.set(guildId, new Map());
    }
    aliasesByGuild.get(guildId).set(userId, alias);
    persist();
  }

  function remove(guildId, userId) {
    aliasesByGuild.get(guildId)?.delete(userId);
    persist();
  }

  return { get, set, remove };
}
