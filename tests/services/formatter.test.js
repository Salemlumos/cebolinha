import { describe, it, expect } from 'vitest';
import { mergeSegments, buildTranscript, splitTranscriptParts } from '../../src/services/formatter.js';

function seg(userId, displayName, startedAtMs, endedAtMs, text) {
  return { userId, displayName, startedAt: new Date(startedAtMs), endedAt: new Date(endedAtMs), text };
}

describe('mergeSegments', () => {
  it('ordena por startedAt mesmo se a entrada estiver fora de ordem', () => {
    const result = mergeSegments([seg('u1', 'A', 2000, 2500, 'segundo'), seg('u2', 'B', 0, 500, 'primeiro')]);
    expect(result.map((s) => s.text)).toEqual(['primeiro', 'segundo']);
  });

  it('mescla segmentos consecutivos do mesmo falante quando o intervalo é pequeno', () => {
    const result = mergeSegments([seg('u1', 'A', 0, 1000, 'oi'), seg('u1', 'A', 1500, 2000, 'tudo bem')], 3000);
    expect(result).toHaveLength(1);
    expect(result[0].text).toBe('oi tudo bem');
    expect(result[0].endedAt.getTime()).toBe(2000);
  });

  it('não mescla quando o intervalo excede o limite', () => {
    const result = mergeSegments([seg('u1', 'A', 0, 1000, 'oi'), seg('u1', 'A', 10000, 11000, 'depois')], 3000);
    expect(result).toHaveLength(2);
  });

  it('não mescla falantes diferentes mesmo consecutivos', () => {
    const result = mergeSegments([seg('u1', 'A', 0, 1000, 'oi'), seg('u2', 'B', 1200, 2000, 'oi também')], 3000);
    expect(result).toHaveLength(2);
  });
});

describe('buildTranscript', () => {
  it('formata cabeçalho e linhas com tempo relativo ao início da sessão', () => {
    const sessionStartedAt = new Date(0);
    const transcript = buildTranscript({
      segments: [seg('u1', 'Alice', 5000, 6000, 'olá pessoal')],
      sessionStartedAt,
      sessionEndedAt: new Date(10_000),
      participants: ['Alice', 'Bob'],
    });

    expect(transcript).toContain('Participantes: Alice, Bob');
    expect(transcript).toContain('Duração: 00:00:10');
    expect(transcript).toContain('[00:00:05] Alice: olá pessoal');
  });

  it('separa falas de participantes diferentes com uma linha em branco', () => {
    const sessionStartedAt = new Date(0);
    const transcript = buildTranscript({
      segments: [seg('u1', 'Alice', 0, 1000, 'oi'), seg('u2', 'Bob', 5000, 6000, 'oi Alice')],
      sessionStartedAt,
      sessionEndedAt: new Date(10_000),
      participants: ['Alice', 'Bob'],
    });

    expect(transcript).toContain('[00:00:00] Alice: oi\n\n[00:00:05] Bob: oi Alice');
  });
});

describe('splitTranscriptParts', () => {
  it('retorna uma única parte quando cabe no limite', () => {
    const parts = splitTranscriptParts('linha1\nlinha2', 1000);
    expect(parts).toEqual(['linha1\nlinha2']);
  });

  it('divide em partes sem cortar uma linha no meio', () => {
    const text = ['aaaa', 'bbbb', 'cccc', 'dddd'].join('\n');
    const parts = splitTranscriptParts(text, 10);
    expect(parts).toEqual(['aaaa\nbbbb', 'cccc\ndddd']);
    for (const part of parts) {
      expect(Buffer.byteLength(part, 'utf8')).toBeLessThanOrEqual(10);
    }
  });
});
