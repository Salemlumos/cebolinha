import { createSession } from './session.js';

const ACTIVE_STATES = new Set(['recording', 'paused', 'finishing']);

/**
 * Garante uma sessão por guild. Estado em memória — sem persistência em
 * disco/DB (fora de escopo do projeto).
 * @returns {{
 *   get(guildId: string): import('./session.js').Session,
 *   set(guildId: string, session: import('./session.js').Session): import('./session.js').Session,
 *   has(guildId: string): boolean,
 *   remove(guildId: string): void,
 *   all(): Map<string, import('./session.js').Session>,
 * }}
 */
export function createSessionManager() {
  const sessions = new Map();

  function get(guildId) {
    return sessions.get(guildId) ?? createSession(guildId);
  }

  function set(guildId, session) {
    sessions.set(guildId, session);
    return session;
  }

  function has(guildId) {
    const session = sessions.get(guildId);
    return Boolean(session && ACTIVE_STATES.has(session.state));
  }

  function remove(guildId) {
    sessions.delete(guildId);
  }

  function all() {
    return sessions;
  }

  return { get, set, has, remove, all };
}
