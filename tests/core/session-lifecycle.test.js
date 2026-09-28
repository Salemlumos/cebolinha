import { describe, it, expect, vi } from 'vitest';
import { finishSession, cancelSession } from '../../src/core/session-lifecycle.js';
import { createSessionManager } from '../../src/core/session-manager.js';
import { createRecorderRegistry } from '../../src/core/recorder-registry.js';
import { start } from '../../src/core/session.js';

function makeLogger() {
  return { error: vi.fn(), info: vi.fn(), child: () => makeLogger() };
}

const startParams = { voiceChannelId: 'vc-1', textChannelId: 'tc-1', startedBy: 'user-1' };

describe('finishSession', () => {
  it('retorna not-recording quando não há sessão ativa', async () => {
    const ctx = {
      sessionManager: createSessionManager(),
      recorderRegistry: createRecorderRegistry(),
      env: {},
      logger: makeLogger(),
    };
    const result = await finishSession('guild-1', ctx);
    expect(result).toEqual({ ok: false, code: 'not-recording' });
  });

  it('retorna emptyMessage quando não há segmentos capturados', async () => {
    const sessionManager = createSessionManager();
    sessionManager.set('guild-1', start(sessionManager.get('guild-1'), startParams).session);
    const ctx = { sessionManager, recorderRegistry: createRecorderRegistry(), env: {}, logger: makeLogger() };

    const result = await finishSession('guild-1', ctx);

    expect(result).toEqual({ ok: true, emptyMessage: true });
    expect(sessionManager.has('guild-1')).toBe(false);
  });

  it('para o recorder antes de seguir, se houver um registrado', async () => {
    const sessionManager = createSessionManager();
    sessionManager.set('guild-1', start(sessionManager.get('guild-1'), startParams).session);
    const recorderRegistry = createRecorderRegistry();
    const stop = vi.fn().mockResolvedValue();
    recorderRegistry.set('guild-1', { stop, pause: vi.fn(), resume: vi.fn() });
    const ctx = { sessionManager, recorderRegistry, env: {}, logger: makeLogger() };

    await finishSession('guild-1', ctx);

    expect(stop).toHaveBeenCalledOnce();
    expect(recorderRegistry.get('guild-1')).toBeUndefined();
  });
});

describe('cancelSession', () => {
  it('retorna not-active quando não há sessão ativa', async () => {
    const ctx = {
      sessionManager: createSessionManager(),
      recorderRegistry: createRecorderRegistry(),
      env: {},
      logger: makeLogger(),
    };
    const result = await cancelSession('guild-1', ctx);
    expect(result).toEqual({ ok: false, code: 'not-active' });
  });

  it('cancela e remove a sessão do guild', async () => {
    const sessionManager = createSessionManager();
    sessionManager.set('guild-1', start(sessionManager.get('guild-1'), startParams).session);
    const ctx = {
      sessionManager,
      recorderRegistry: createRecorderRegistry(),
      env: { DATA_DIR: 'I:/dev/projets/cebolinha/data-test-tmp' },
      logger: makeLogger(),
    };

    const result = await cancelSession('guild-1', ctx);

    expect(result).toEqual({ ok: true });
    expect(sessionManager.has('guild-1')).toBe(false);
  });
});
