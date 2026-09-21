import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { EndBehaviorType } from '@discordjs/voice';
import prism from 'prism-media';
import ffmpegPath from 'ffmpeg-static';

/**
 * Grava cada fala de cada participante em um WAV 16kHz mono separado,
 * segmentado por silêncio (`EndBehaviorType.AfterSilence`). Um segmento por
 * "turno de fala". Erros num segmento são logados e descartados — nunca
 * derrubam a sessão (spec §5).
 *
 * @param {Object} params
 * @param {import('@discordjs/voice').VoiceConnection} params.connection
 * @param {string} params.sessionId
 * @param {string} params.dataDir
 * @param {number} params.silenceMs
 * @param {number} params.minSegmentMs
 * @param {(userId: string) => Promise<string>|string} params.resolveDisplayName
 * @param {import('pino').Logger} params.logger
 * @param {(segment: { userId: string, displayName: string, filePath: string, startedAt: Date, endedAt: Date }) => void} params.onSegment
 * @returns {{ pause(): void, resume(): void, stop(): Promise<void> }}
 */
export function createRecorder({
  connection,
  sessionId,
  dataDir,
  silenceMs,
  minSegmentMs,
  resolveDisplayName,
  logger,
  onSegment,
}) {
  const sessionDir = join(dataDir, 'sessions', sessionId);
  mkdirSync(sessionDir, { recursive: true });

  let paused = false;
  const activeRecordings = new Map();

  async function recordSegment(userId) {
    const startedAt = new Date();
    const fileName = `${startedAt.getTime()}_${userId}.wav`;
    const filePath = join(sessionDir, fileName);

    const opusStream = connection.receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: silenceMs },
    });
    const decoder = new prism.opus.Decoder({ rate: 48_000, channels: 2, frameSize: 960 });
    const ffmpeg = spawn(ffmpegPath, [
      '-y',
      '-f',
      's16le',
      '-ar',
      '48000',
      '-ac',
      '2',
      '-i',
      'pipe:0',
      '-ar',
      '16000',
      '-ac',
      '1',
      filePath,
    ]);

    let ffmpegStderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      ffmpegStderr += chunk.toString();
    });

    const finished = new Promise((resolve) => {
      let settled = false;
      const settle = (ok, err) => {
        if (settled) return;
        settled = true;
        resolve({ ok, err });
      };
      opusStream.on('error', (err) => settle(false, err));
      decoder.on('error', (err) => settle(false, err));
      ffmpeg.on('error', (err) => settle(false, err));
      ffmpeg.on('close', (code) =>
        settle(code === 0, code === 0 ? null : new Error(`ffmpeg saiu com código ${code}: ${ffmpegStderr}`)),
      );
    });

    opusStream.pipe(decoder).pipe(ffmpeg.stdin);

    const { ok, err } = await finished;
    const endedAt = new Date();

    if (!ok) {
      logger.error({ err: err?.message, userId, sessionId }, 'Falha ao gravar segmento de fala');
      return;
    }

    const durationMs = endedAt.getTime() - startedAt.getTime();
    if (durationMs < minSegmentMs) {
      return;
    }

    const displayName = await resolveDisplayName(userId);
    onSegment({ userId, displayName, filePath, startedAt, endedAt });
  }

  function handleSpeakingStart(userId) {
    if (paused || activeRecordings.has(userId)) return;
    const promise = recordSegment(userId)
      .catch((err) => logger.error({ err: err.message, userId, sessionId }, 'Erro inesperado gravando segmento'))
      .finally(() => activeRecordings.delete(userId));
    activeRecordings.set(userId, promise);
  }

  connection.receiver.speaking.on('start', handleSpeakingStart);

  return {
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    async stop() {
      paused = true;
      connection.receiver.speaking.removeListener('start', handleSpeakingStart);
      await Promise.all([...activeRecordings.values()]);
    },
  };
}
