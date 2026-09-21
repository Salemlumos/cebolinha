import { describe, it, expect, vi } from 'vitest';
import { transcribeSegments } from '../../src/services/transcriber/run-batch.js';

const noopSleep = () => Promise.resolve();

describe('transcribeSegments', () => {
  it('transcreve todos os segmentos com sucesso, preservando a ordem', async () => {
    const transcriber = { transcribe: vi.fn(async (filePath) => ({ text: `texto de ${filePath}` })) };
    const segments = [{ filePath: 'a.wav' }, { filePath: 'b.wav' }, { filePath: 'c.wav' }];

    const results = await transcribeSegments(transcriber, segments, { concurrency: 2, sleepFn: noopSleep });

    expect(results.map((r) => r.text)).toEqual(['texto de a.wav', 'texto de b.wav', 'texto de c.wav']);
  });

  it('faz retry em falha transitória e usa o resultado do sucesso subsequente', async () => {
    let calls = 0;
    const transcriber = {
      transcribe: vi.fn(async () => {
        calls += 1;
        if (calls < 3) throw new Error('falha transitória');
        return { text: 'ok depois de retry' };
      }),
    };

    const results = await transcribeSegments(transcriber, [{ filePath: 'a.wav' }], {
      retries: 3,
      sleepFn: noopSleep,
    });

    expect(calls).toBe(3);
    expect(results[0].text).toBe('ok depois de retry');
  });

  it('usa o texto de fallback quando todas as tentativas falham, sem lançar', async () => {
    const transcriber = { transcribe: vi.fn(async () => { throw new Error('sempre falha'); }) };

    const results = await transcribeSegments(transcriber, [{ filePath: 'a.wav' }], {
      retries: 2,
      sleepFn: noopSleep,
    });

    expect(results[0].text).toBe('[trecho não transcrito]');
    expect(transcriber.transcribe).toHaveBeenCalledTimes(3); // tentativa inicial + 2 retries
  });

  it('respeita o limite de concorrência configurado', async () => {
    let active = 0;
    let maxActive = 0;
    const transcriber = {
      transcribe: vi.fn(async () => {
        active += 1;
        maxActive = Math.max(maxActive, active);
        await new Promise((resolve) => setTimeout(resolve, 20));
        active -= 1;
        return { text: 'ok' };
      }),
    };
    const segments = Array.from({ length: 6 }, (_, i) => ({ filePath: `${i}.wav` }));

    await transcribeSegments(transcriber, segments, { concurrency: 2, sleepFn: noopSleep });

    expect(maxActive).toBeLessThanOrEqual(2);
  });

  it('preserva os campos originais do segmento além do texto', async () => {
    const transcriber = { transcribe: vi.fn(async () => ({ text: 'ok' })) };
    const results = await transcribeSegments(
      transcriber,
      [{ filePath: 'a.wav', userId: 'u1', displayName: 'Alice' }],
      { sleepFn: noopSleep },
    );

    expect(results[0]).toMatchObject({ filePath: 'a.wav', userId: 'u1', displayName: 'Alice', text: 'ok' });
  });
});
