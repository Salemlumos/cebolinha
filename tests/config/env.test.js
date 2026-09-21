import { describe, it, expect } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

const baseValidEnv = {
  DISCORD_TOKEN: 'token-123',
  DISCORD_CLIENT_ID: 'client-123',
};

describe('parseEnv', () => {
  it('aceita a config mínima válida e aplica defaults', () => {
    const result = parseEnv(baseValidEnv);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      DISCORD_TOKEN: 'token-123',
      DISCORD_CLIENT_ID: 'client-123',
      TRANSCRIBER_PROVIDER: 'local',
      TRANSCRIBE_MODEL: 'Xenova/whisper-base',
      TRANSCRIBE_LANGUAGE: 'pt',
      SILENCE_MS: 1000,
      MIN_SEGMENT_MS: 400,
      TRANSCRIBE_CONCURRENCY: 3,
      MAX_SESSION_MINUTES: 120,
      KEEP_AUDIO: false,
      DATA_DIR: './data',
      LOG_LEVEL: 'info',
    });
  });

  it('rejeita quando falta DISCORD_TOKEN', () => {
    const result = parseEnv({ DISCORD_CLIENT_ID: 'client-123' });
    expect(result.success).toBe(false);
    const paths = result.error.issues.map((issue) => issue.path.join('.'));
    expect(paths).toContain('DISCORD_TOKEN');
  });

  it('aceita ausência de OPENAI_API_KEY (só é exigida ao instanciar o adaptador OpenAI)', () => {
    const result = parseEnv(baseValidEnv);
    expect(result.success).toBe(true);
    expect(result.data.OPENAI_API_KEY).toBeUndefined();
  });

  it('converte KEEP_AUDIO="true" em booleano true', () => {
    const result = parseEnv({ ...baseValidEnv, KEEP_AUDIO: 'true' });
    expect(result.success).toBe(true);
    expect(result.data.KEEP_AUDIO).toBe(true);
  });

  it('coage SILENCE_MS numérico a partir de string', () => {
    const result = parseEnv({ ...baseValidEnv, SILENCE_MS: '1500' });
    expect(result.success).toBe(true);
    expect(result.data.SILENCE_MS).toBe(1500);
  });
});
