import { describe, it, expect } from 'vitest';
import { createLogger } from '../../src/utils/logger.js';

describe('createLogger', () => {
  it('usa nível "info" por padrão', () => {
    const logger = createLogger();
    expect(logger.level).toBe('info');
  });

  it('respeita o nível informado', () => {
    const logger = createLogger({ level: 'debug' });
    expect(logger.level).toBe('debug');
  });

  it('permite criar logger filho com contexto', () => {
    const logger = createLogger({ level: 'info' });
    const child = logger.child({ guildId: 'guild-1' });
    expect(typeof child.info).toBe('function');
    expect(typeof child.error).toBe('function');
  });
});
