import { describe, it, expect } from 'vitest';
import { createTranscriber } from '../../src/services/transcriber/index.js';

describe('createTranscriber', () => {
  it('cria o adaptador local quando TRANSCRIBER_PROVIDER=local', () => {
    const transcriber = createTranscriber({ TRANSCRIBER_PROVIDER: 'local', TRANSCRIBE_MODEL: 'Xenova/whisper-base' });
    expect(typeof transcriber.transcribe).toBe('function');
  });

  it('cria o adaptador groq quando GROQ_API_KEY está presente', () => {
    const transcriber = createTranscriber({
      TRANSCRIBER_PROVIDER: 'groq',
      GROQ_API_KEY: 'gsk-abc',
      TRANSCRIBE_MODEL: 'whisper-large-v3-turbo',
    });
    expect(typeof transcriber.transcribe).toBe('function');
  });

  it('lança erro claro se TRANSCRIBER_PROVIDER=groq sem GROQ_API_KEY', () => {
    expect(() => createTranscriber({ TRANSCRIBER_PROVIDER: 'groq' })).toThrow(/GROQ_API_KEY/);
  });

  it('lança erro claro se TRANSCRIBER_PROVIDER=openai sem OPENAI_API_KEY', () => {
    expect(() => createTranscriber({ TRANSCRIBER_PROVIDER: 'openai' })).toThrow(/OPENAI_API_KEY/);
  });

  it('cria o adaptador openai quando OPENAI_API_KEY está presente', () => {
    const transcriber = createTranscriber({
      TRANSCRIBER_PROVIDER: 'openai',
      OPENAI_API_KEY: 'sk-abc',
      TRANSCRIBE_MODEL: 'whisper-1',
    });
    expect(typeof transcriber.transcribe).toBe('function');
  });
});
