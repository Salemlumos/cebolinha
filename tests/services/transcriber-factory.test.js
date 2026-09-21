import { describe, it, expect } from 'vitest';
import { createTranscriber } from '../../src/services/transcriber/index.js';

describe('createTranscriber', () => {
  it('cria o adaptador Groq com a interface Transcriber', () => {
    const transcriber = createTranscriber({
      GROQ_API_KEY: 'gsk-abc',
      TRANSCRIBE_MODEL: 'whisper-large-v3-turbo',
      TRANSCRIBE_LANGUAGE: 'pt',
    });
    expect(typeof transcriber.transcribe).toBe('function');
  });
});
