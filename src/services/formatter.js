const DEFAULT_MERGE_GAP_MS = 3000;
const DISCORD_ATTACHMENT_LIMIT_BYTES = 8 * 1024 * 1024;

/**
 * @typedef {Object} TranscribedSegment
 * @property {string} userId
 * @property {string} displayName
 * @property {Date} startedAt
 * @property {Date} endedAt
 * @property {string} text
 */

function formatTimeOffset(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

/**
 * Ordena por `startedAt` e mescla segmentos consecutivos do mesmo falante
 * quando o intervalo entre eles é pequeno.
 * @param {TranscribedSegment[]} segments
 * @param {number} [mergeGapMs]
 * @returns {TranscribedSegment[]}
 */
export function mergeSegments(segments, mergeGapMs = DEFAULT_MERGE_GAP_MS) {
  const sorted = [...segments].sort((a, b) => a.startedAt.getTime() - b.startedAt.getTime());
  const merged = [];

  for (const segment of sorted) {
    const last = merged[merged.length - 1];
    const gapMs = last ? segment.startedAt.getTime() - last.endedAt.getTime() : Infinity;
    if (last && last.userId === segment.userId && gapMs <= mergeGapMs) {
      last.endedAt = segment.endedAt;
      last.text = `${last.text} ${segment.text}`.trim();
    } else {
      merged.push({ ...segment });
    }
  }

  return merged;
}

/**
 * Monta o transcript final em markdown: cabeçalho (data, duração,
 * participantes) seguido das falas ordenadas e mescladas, no formato
 * `[HH:MM:SS] Nome: texto` com tempo relativo ao início da sessão, com uma
 * linha em branco entre cada fala pra facilitar a leitura.
 * @param {Object} params
 * @param {TranscribedSegment[]} params.segments
 * @param {Date} params.sessionStartedAt
 * @param {Date} params.sessionEndedAt
 * @param {string[]} params.participants
 * @returns {string}
 */
export function buildTranscript({ segments, sessionStartedAt, sessionEndedAt, participants }) {
  const merged = mergeSegments(segments);
  const lines = merged.map((segment) => {
    const offsetMs = segment.startedAt.getTime() - sessionStartedAt.getTime();
    return `[${formatTimeOffset(offsetMs)}] ${segment.displayName}: ${segment.text}`;
  });

  const durationMs = sessionEndedAt.getTime() - sessionStartedAt.getTime();
  const header = [
    '# Transcrição da call',
    '',
    `Data: ${sessionStartedAt.toISOString()}`,
    `Duração: ${formatTimeOffset(durationMs)}`,
    `Participantes: ${participants.length > 0 ? participants.join(', ') : 'nenhum'}`,
    '',
  ].join('\n');

  return `${header}\n${lines.join('\n\n')}\n`;
}

/**
 * Divide o transcript em partes que respeitam o limite de tamanho de anexo
 * do Discord, cortando em quebras de linha (nunca no meio de uma linha).
 * @param {string} text
 * @param {number} [maxBytes]
 * @returns {string[]}
 */
export function splitTranscriptParts(text, maxBytes = DISCORD_ATTACHMENT_LIMIT_BYTES) {
  if (Buffer.byteLength(text, 'utf8') <= maxBytes) {
    return [text];
  }

  const lines = text.split('\n');
  const parts = [];
  let current = '';

  for (const line of lines) {
    const candidate = current.length > 0 ? `${current}\n${line}` : line;
    if (Buffer.byteLength(candidate, 'utf8') > maxBytes && current.length > 0) {
      parts.push(current);
      current = line;
    } else {
      current = candidate;
    }
  }
  if (current.length > 0) parts.push(current);

  return parts;
}
