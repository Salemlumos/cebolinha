import { describe, it, expect } from 'vitest';
import { createSession, start, pause, resume, finish, complete, cancel } from '../../src/core/session.js';

const startParams = { voiceChannelId: 'vc-1', textChannelId: 'tc-1', startedBy: 'user-1' };

describe('session state machine', () => {
  it('começa em idle', () => {
    expect(createSession('guild-1').state).toBe('idle');
  });

  it('idle -> recording via start', () => {
    const result = start(createSession('guild-1'), startParams);
    expect(result.success).toBe(true);
    expect(result.session.state).toBe('recording');
    expect(result.session.voiceChannelId).toBe('vc-1');
  });

  it('recording -> paused via pause', () => {
    const recording = start(createSession('guild-1'), startParams).session;
    const result = pause(recording);
    expect(result.success).toBe(true);
    expect(result.session.state).toBe('paused');
  });

  it('paused -> recording via resume', () => {
    const paused = pause(start(createSession('guild-1'), startParams).session).session;
    const result = resume(paused);
    expect(result.success).toBe(true);
    expect(result.session.state).toBe('recording');
  });

  it('recording -> finishing -> done', () => {
    const recording = start(createSession('guild-1'), startParams).session;
    const finishing = finish(recording);
    expect(finishing.success).toBe(true);
    expect(finishing.session.state).toBe('finishing');
    const done = complete(finishing.session);
    expect(done.success).toBe(true);
    expect(done.session.state).toBe('done');
  });

  it('paused -> finishing também é permitido', () => {
    const paused = pause(start(createSession('guild-1'), startParams).session).session;
    const result = finish(paused);
    expect(result.success).toBe(true);
    expect(result.session.state).toBe('finishing');
  });

  it('recording/paused -> cancelled via cancel', () => {
    const recording = start(createSession('guild-1'), startParams).session;
    const result = cancel(recording);
    expect(result.success).toBe(true);
    expect(result.session.state).toBe('cancelled');
    expect(result.session.endedAt).toBeInstanceOf(Date);
  });

  it('rejeita start quando já está recording', () => {
    const recording = start(createSession('guild-1'), startParams).session;
    const result = start(recording, startParams);
    expect(result.success).toBe(false);
    expect(result.message).toMatch(/não é possível/i);
  });

  it('rejeita pause quando idle', () => {
    const result = pause(createSession('guild-1'));
    expect(result.success).toBe(false);
  });

  it('rejeita resume quando recording', () => {
    const recording = start(createSession('guild-1'), startParams).session;
    const result = resume(recording);
    expect(result.success).toBe(false);
  });

  it('nunca lança exceção para uma transição inválida', () => {
    expect(() => finish(createSession('guild-1'))).not.toThrow();
  });
});
