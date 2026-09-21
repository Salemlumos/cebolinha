/**
 * Máquina de estados pura de uma sessão de gravação. Não faz I/O (sem
 * Discord, sem arquivos) — só transições de estado, testável isoladamente.
 *
 * @typedef {'idle'|'recording'|'paused'|'finishing'|'done'|'cancelled'} SessionState
 *
 * @typedef {Object} Session
 * @property {string} guildId
 * @property {string} [id]
 * @property {SessionState} state
 * @property {string} [voiceChannelId]
 * @property {string} [textChannelId]
 * @property {string} [startedBy]
 * @property {Date} [startedAt]
 * @property {Date} [endedAt]
 * @property {Array<Object>} segments
 * @property {Set<string>} speakerIds
 *
 * @typedef {{ success: true, session: Session } | { success: false, message: string }} TransitionResult
 */

/**
 * @param {string} guildId
 * @returns {Session}
 */
export function createSession(guildId) {
  return { guildId, state: 'idle', segments: [], speakerIds: new Set() };
}

const TRANSITIONS = {
  start: { from: ['idle'], to: 'recording' },
  pause: { from: ['recording'], to: 'paused' },
  resume: { from: ['paused'], to: 'recording' },
  finish: { from: ['recording', 'paused'], to: 'finishing' },
  complete: { from: ['finishing'], to: 'done' },
  cancel: { from: ['idle', 'recording', 'paused'], to: 'cancelled' },
};

/**
 * @param {Session} session
 * @param {keyof typeof TRANSITIONS} event
 * @param {Partial<Session>} [patch]
 * @returns {TransitionResult}
 */
function applyEvent(session, event, patch = {}) {
  const definition = TRANSITIONS[event];
  if (!definition.from.includes(session.state)) {
    return {
      success: false,
      message: `Não é possível executar "${event}" a partir do estado "${session.state}".`,
    };
  }
  return { success: true, session: { ...session, ...patch, state: definition.to } };
}

/**
 * @param {Session} session
 * @param {{ voiceChannelId: string, textChannelId: string, startedBy: string, startedAt?: Date }} params
 * @returns {TransitionResult}
 */
export function start(session, { voiceChannelId, textChannelId, startedBy, startedAt = new Date() }) {
  return applyEvent(session, 'start', {
    id: `${session.guildId}_${startedAt.getTime()}`,
    voiceChannelId,
    textChannelId,
    startedBy,
    startedAt,
  });
}

/** @param {Session} session @returns {TransitionResult} */
export function pause(session) {
  return applyEvent(session, 'pause');
}

/** @param {Session} session @returns {TransitionResult} */
export function resume(session) {
  return applyEvent(session, 'resume');
}

/** @param {Session} session @returns {TransitionResult} */
export function finish(session) {
  return applyEvent(session, 'finish');
}

/**
 * @param {Session} session
 * @param {Partial<Session>} [patch]
 * @returns {TransitionResult}
 */
export function complete(session, patch = {}) {
  return applyEvent(session, 'complete', patch);
}

/** @param {Session} session @returns {TransitionResult} */
export function cancel(session) {
  return applyEvent(session, 'cancel', { endedAt: new Date() });
}
