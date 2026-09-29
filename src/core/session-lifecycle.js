import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import * as session from './session.js';
import { createTranscriber } from '../services/transcriber/index.js';
import { transcribeSegments } from '../services/transcriber/run-batch.js';
import { buildTranscript, splitTranscriptParts } from '../services/formatter.js';

/**
 * Orquestra o encerramento de uma sessão: para a captura, transcreve,
 * monta os arquivos finais, limpa os áudios. Não fala com o Discord além
 * de ler os registries injetados — quem chama decide como entregar o
 * resultado (reply de comando, mensagem de canal no fail-safe de
 * inatividade, etc). Nunca lança: erros voltam como `{ ok: false, code }`.
 *
 * @param {string} guildId
 * @param {{
 *   sessionManager: ReturnType<typeof import('./session-manager.js').createSessionManager>,
 *   recorderRegistry: ReturnType<typeof import('./recorder-registry.js').createRecorderRegistry>,
 *   env: import('../config/env.js').Env,
 *   logger: import('pino').Logger,
 * }} ctx
 * @returns {Promise<
 *   { ok: false, code: 'not-recording' | 'transcribe-failed' } |
 *   { ok: true, emptyMessage: true } |
 *   { ok: true, parts: string[] }
 * >}
 */
export async function finishSession(guildId, { sessionManager, recorderRegistry, env, logger }) {
  const before = sessionManager.get(guildId);
  const result = session.finish(before);
  if (!result.success) {
    return { ok: false, code: 'not-recording' };
  }

  const finishingSession = result.session;
  sessionManager.set(guildId, finishingSession);

  const recorder = recorderRegistry.get(guildId);
  if (recorder) await recorder.stop();
  recorderRegistry.remove(guildId);

  if (finishingSession.segments.length === 0) {
    sessionManager.remove(guildId);
    return { ok: true, emptyMessage: true };
  }

  try {
    const transcriber = createTranscriber(env);
    const transcribed = await transcribeSegments(transcriber, finishingSession.segments, {
      concurrency: env.TRANSCRIBE_CONCURRENCY,
      language: env.TRANSCRIBE_LANGUAGE,
      logger,
    });
    const participantNames = new Map(transcribed.map((seg) => [seg.userId, seg.displayName]));

    const transcript = buildTranscript({
      segments: transcribed,
      sessionStartedAt: finishingSession.startedAt,
      sessionEndedAt: new Date(),
      participants: [...finishingSession.speakerIds].map((id) => participantNames.get(id) ?? id),
    });

    sessionManager.set(guildId, session.complete(finishingSession).session);

    if (!env.KEEP_AUDIO) {
      await rm(join(env.DATA_DIR, 'sessions', finishingSession.id), { recursive: true, force: true }).catch((err) =>
        logger.error({ err: err.message, guildId }, 'Falha ao apagar áudios após finalizar a sessão'),
      );
    }

    sessionManager.remove(guildId);
    return { ok: true, parts: splitTranscriptParts(transcript) };
  } catch (err) {
    logger.error({ err: err.message, guildId }, 'Falha ao transcrever sessão');
    sessionManager.set(guildId, session.complete(finishingSession).session);
    return { ok: false, code: 'transcribe-failed' };
  }
}

/**
 * Orquestra o cancelamento de uma sessão: para a captura, apaga os
 * áudios, descarta a sessão. Mesmo contrato de retorno que `finishSession`.
 * @param {string} guildId
 * @param {{
 *   sessionManager: ReturnType<typeof import('./session-manager.js').createSessionManager>,
 *   recorderRegistry: ReturnType<typeof import('./recorder-registry.js').createRecorderRegistry>,
 *   env: import('../config/env.js').Env,
 *   logger: import('pino').Logger,
 * }} ctx
 * @returns {Promise<{ ok: false, code: 'not-active' } | { ok: true }>}
 */
export async function cancelSession(guildId, { sessionManager, recorderRegistry, env, logger }) {
  const before = sessionManager.get(guildId);
  const result = session.cancel(before);
  if (!result.success) {
    return { ok: false, code: 'not-active' };
  }

  const recorder = recorderRegistry.get(guildId);
  if (recorder) await recorder.stop();
  recorderRegistry.remove(guildId);

  if (before.id) {
    await rm(join(env.DATA_DIR, 'sessions', before.id), { recursive: true, force: true }).catch((err) =>
      logger.error({ err: err.message, guildId }, 'Falha ao apagar áudios da sessão cancelada'),
    );
  }

  sessionManager.remove(guildId);
  return { ok: true };
}
