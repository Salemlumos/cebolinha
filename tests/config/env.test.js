import { describe, it, expect } from 'vitest';
import { parseEnv } from '../../src/config/env.js';

const baseValidEnv = {
  DISCORD_TOKEN: 'token-123',
  DISCORD_CLIENT_ID: 'client-123',
  GROQ_API_KEY: 'gsk-abc',
};

describe('parseEnv', () => {
  it('aceita a config mínima válida e aplica defaults', () => {
    const result = parseEnv(baseValidEnv);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      DISCORD_TOKEN: 'token-123',
      DISCORD_CLIENT_ID: 'client-123',
      GROQ_API_KEY: 'gsk-abc',
      TRANSCRIBE_MODEL: 'whisper-large-v3-turbo',
      TRANSCRIBE_LANGUAGE: 'pt',
      SILENCE_MS: 1000,
      MIN_SEGMENT_MS: 400,
      TRANSCRIBE_CONCURRENCY: 3,
      MAX_SESSION_MINUTES: 120,
      KEEP_AUDIO: false,
      DATA_DIR: './data',
      LOG_LEVEL: 'info',
      EMPTY_CHANNEL_TIMEOUT_MS: 300_000,
      EMPTY_CHANNEL_POLICY: 'finish',
    });
  });

  it('rejeita quando falta DISCORD_TOKEN', () => {
    const result = parseEnv({ DISCORD_CLIENT_ID: 'client-123', GROQ_API_KEY: 'gsk-abc' });
    expect(result.success).toBe(false);
    const paths = result.error.issues.map((issue) => issue.path.join('.'));
    expect(paths).toContain('DISCORD_TOKEN');
  });

  it('rejeita quando falta GROQ_API_KEY', () => {
    const result = parseEnv({ DISCORD_TOKEN: 'token-123', DISCORD_CLIENT_ID: 'client-123' });
    expect(result.success).toBe(false);
    const paths = result.error.issues.map((issue) => issue.path.join('.'));
    expect(paths).toContain('GROQ_API_KEY');
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
