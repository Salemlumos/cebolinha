import { describe, it, expect } from 'vitest';
import { createSessionManager } from '../../src/core/session-manager.js';
import { start } from '../../src/core/session.js';

describe('session manager', () => {
  it('retorna uma sessão idle nova para guild sem sessão registrada', () => {
    const manager = createSessionManager();
    expect(manager.get('guild-1').state).toBe('idle');
  });

  it('has() é falso para guild sem sessão ativa', () => {
    const manager = createSessionManager();
    expect(manager.has('guild-1')).toBe(false);
  });

  it('has() é verdadeiro após start bem-sucedido', () => {
    const manager = createSessionManager();
    const result = start(manager.get('guild-1'), {
      voiceChannelId: 'vc-1',
      textChannelId: 'tc-1',
      startedBy: 'user-1',
    });
    manager.set('guild-1', result.session);
    expect(manager.has('guild-1')).toBe(true);
  });

  it('sessões são isoladas por guild', () => {
    const manager = createSessionManager();
    const result = start(manager.get('guild-1'), {
      voiceChannelId: 'vc-1',
      textChannelId: 'tc-1',
      startedBy: 'user-1',
    });
    manager.set('guild-1', result.session);
    expect(manager.has('guild-2')).toBe(false);
    expect(manager.get('guild-2').state).toBe('idle');
  });

  it('remove() limpa a sessão da guild', () => {
    const manager = createSessionManager();
    const result = start(manager.get('guild-1'), {
      voiceChannelId: 'vc-1',
      textChannelId: 'tc-1',
      startedBy: 'user-1',
    });
    manager.set('guild-1', result.session);
    manager.remove('guild-1');
    expect(manager.has('guild-1')).toBe(false);
    expect(manager.get('guild-1').state).toBe('idle');
  });
});
