#!/usr/bin/env node
/**
 * Fase 0 — spike técnico.
 *
 * Entra em um canal de voz, aguarda um usuário específico começar a falar,
 * grava essa fala (decodificando Opus -> PCM -> WAV 16kHz mono) e roda uma
 * análise de amplitude no arquivo resultante para provar programaticamente
 * que o áudio recebido não é silêncio/corrompido.
 *
 * Uso:
 *   node scripts/spike-record.js <voiceChannelId> <targetUserId> [timeoutMs]
 *
 * Regra de parada: se o áudio chegar vazio, corrompido, ou houver erro de
 * decriptografia/DAVE, o script sai com código 1 e imprime um diagnóstico
 * completo (versões instaladas, estado da conexão, contagem de pacotes
 * Opus recebidos). Não avance para a Fase 1 sem ver "SPIKE PASSOU" aqui.
 */
import { spawn } from 'node:child_process';
import { mkdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client, GatewayIntentBits } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus, EndBehaviorType, entersState } from '@discordjs/voice';
import prism from 'prism-media';
import ffmpegPath from 'ffmpeg-static';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/utils/logger.js';

const scriptDir = dirname(fileURLToPath(import.meta.url));

const DEFAULT_TIMEOUT_MS = 30_000;
const MIN_PEAK_AMPLITUDE = 500; // de 32767 (int16) — abaixo disso tratamos como silêncio

function getPackageVersion(pkgName) {
  try {
    const pkgJsonPath = join(scriptDir, '..', 'node_modules', pkgName, 'package.json');
    return JSON.parse(readFileSync(pkgJsonPath, 'utf8')).version;
  } catch {
    return 'desconhecida';
  }
}

function logVersions(logger) {
  logger.info(
    {
      node: process.version,
      'discord.js': getPackageVersion('discord.js'),
      '@discordjs/voice': getPackageVersion('@discordjs/voice'),
      '@snazzah/davey': getPackageVersion('@snazzah/davey'),
      'prism-media': getPackageVersion('prism-media'),
      opusscript: getPackageVersion('opusscript'),
    },
    'Versões instaladas',
  );
}

/**
 * Lê um WAV PCM16 canônico (cabeçalho de 44 bytes escrito pelo ffmpeg) e
 * calcula pico e RMS das amostras, para provar que o áudio não é silêncio.
 * @param {string} filePath
 * @returns {{ durationSeconds: number, peakAmplitude: number, rms: number, sampleRate: number }}
 */
function analyzeWav(filePath) {
  const buffer = readFileSync(filePath);
  if (buffer.toString('ascii', 0, 4) !== 'RIFF' || buffer.toString('ascii', 8, 12) !== 'WAVE') {
    throw new Error('Arquivo não é um WAV RIFF válido');
  }
  const sampleRate = buffer.readUInt32LE(24);
  const bitsPerSample = buffer.readUInt16LE(34);
  if (bitsPerSample !== 16) {
    throw new Error(`Esperado PCM16, encontrado ${bitsPerSample} bits por amostra`);
  }
  const dataStart = 44;
  const dataBytes = buffer.length - dataStart;
  const sampleCount = Math.floor(dataBytes / 2);

  let peak = 0;
  let sumSquares = 0;
  for (let i = 0; i < sampleCount; i += 1) {
    const sample = buffer.readInt16LE(dataStart + i * 2);
    const abs = Math.abs(sample);
    if (abs > peak) peak = abs;
    sumSquares += sample * sample;
  }
  const rms = sampleCount > 0 ? Math.sqrt(sumSquares / sampleCount) : 0;
  const durationSeconds = sampleCount / sampleRate;

  return { durationSeconds, peakAmplitude: peak, rms, sampleRate };
}

/**
 * Decodifica o stream Opus de um usuário e grava um WAV 16kHz mono via ffmpeg.
 * @param {import('@discordjs/voice').VoiceReceiver} receiver
 * @param {string} userId
 * @param {string} outputPath
 * @param {number} silenceMs
 * @param {import('pino').Logger} logger
 * @returns {Promise<{ packetCount: number }>}
 */
function recordUserToWav(receiver, userId, outputPath, silenceMs, logger) {
  return new Promise((resolve, reject) => {
    const opusStream = receiver.subscribe(userId, {
      end: { behavior: EndBehaviorType.AfterSilence, duration: silenceMs },
    });
    const decoder = new prism.opus.Decoder({ rate: 48_000, channels: 2, frameSize: 960 });

    let packetCount = 0;
    opusStream.on('data', () => {
      packetCount += 1;
    });

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
      outputPath,
    ]);

    let ffmpegStderr = '';
    ffmpeg.stderr.on('data', (chunk) => {
      ffmpegStderr += chunk.toString();
    });

    let settled = false;
    const fail = (err) => {
      if (settled) return;
      settled = true;
      logger.error({ err: err.message, ffmpegStderr }, 'Falha ao gravar/decodificar áudio');
      reject(err);
    };

    opusStream.on('error', (err) => fail(new Error(`opusStream: ${err.message}`)));
    decoder.on('error', (err) => fail(new Error(`decoder: ${err.message}`)));
    ffmpeg.on('error', (err) => fail(new Error(`ffmpeg: ${err.message}`)));

    ffmpeg.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (code !== 0) {
        reject(new Error(`ffmpeg saiu com código ${code}: ${ffmpegStderr}`));
        return;
      }
      resolve({ packetCount });
    });

    opusStream.pipe(decoder).pipe(ffmpeg.stdin);
  });
}

async function main() {
  const env = loadEnv();
  const logger = createLogger({ level: env.LOG_LEVEL, pretty: process.env.NODE_ENV !== 'production' });
  logVersions(logger);

  const [channelId, targetUserId, timeoutArg] = process.argv.slice(2);
  const timeoutMs = Number(timeoutArg) || DEFAULT_TIMEOUT_MS;

  if (!channelId || !targetUserId) {
    logger.error('Uso: node scripts/spike-record.js <voiceChannelId> <targetUserId> [timeoutMs]');
    process.exit(1);
  }

  const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
  });

  const cleanupAndExit = async (connection, code) => {
    try {
      connection?.destroy();
    } catch {
      // conexão já pode estar destruída; seguir para sair do processo.
    }
    client.destroy();
    process.exit(code);
  };

  client.once('ready', async () => {
    logger.info({ user: client.user.tag }, 'Bot logado');

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isVoiceBased()) {
      logger.error({ channelId }, 'Canal de voz não encontrado ou inválido');
      await cleanupAndExit(null, 1);
      return;
    }

    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId: channel.guild.id,
      adapterCreator: channel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });

    process.once('SIGINT', () => cleanupAndExit(connection, 130));

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
    } catch (err) {
      logger.error(
        { err: err.message },
        'Conexão de voz não ficou pronta a tempo — possível problema de rede/permissões',
      );
      await cleanupAndExit(connection, 1);
      return;
    }

    logger.info(
      { targetUserId, timeoutMs },
      `Conectado. Fale continuamente por ~10s no canal — aguardando até ${timeoutMs}ms.`,
    );

    let handled = false;
    const timeout = setTimeout(async () => {
      if (handled) return;
      handled = true;
      logger.error(
        { targetUserId, timeoutMs },
        'SPIKE FALHOU: nenhuma fala detectada do usuário alvo dentro do tempo limite',
      );
      await cleanupAndExit(connection, 1);
    }, timeoutMs);

    connection.receiver.speaking.on('start', async (userId) => {
      if (handled || userId !== targetUserId) return;
      handled = true;
      clearTimeout(timeout);

      mkdirSync(join(env.DATA_DIR, 'spike'), { recursive: true });
      const outputPath = join(env.DATA_DIR, 'spike', `${Date.now()}_${userId}.wav`);
      logger.info({ outputPath }, 'Fala detectada, gravando...');

      try {
        const { packetCount } = await recordUserToWav(
          connection.receiver,
          userId,
          outputPath,
          env.SILENCE_MS,
          logger,
        );
        const analysis = analyzeWav(outputPath);
        logger.info({ packetCount, outputPath, ...analysis }, 'Gravação concluída, análise de amplitude');

        if (packetCount === 0) {
          logger.error(
            'SPIKE FALHOU: zero pacotes Opus recebidos — verifique selfDeaf=false, permissões do bot e versões de @discordjs/voice/@snazzah/davey listadas acima (possível falha de handshake DAVE).',
          );
          await cleanupAndExit(connection, 1);
          return;
        }

        if (analysis.peakAmplitude < MIN_PEAK_AMPLITUDE) {
          logger.error(
            { peakAmplitude: analysis.peakAmplitude, threshold: MIN_PEAK_AMPLITUDE },
            'SPIKE FALHOU: áudio decodificado é essencialmente silêncio — possível falha de decriptografia DAVE ou decodificação Opus. Reporte este log completo antes de avançar.',
          );
          await cleanupAndExit(connection, 1);
          return;
        }

        logger.info(
          { outputPath, ...analysis },
          'SPIKE PASSOU: WAV gravado, contém áudio (não silêncio). Confirme ouvindo o arquivo.',
        );
        await cleanupAndExit(connection, 0);
      } catch (err) {
        logger.error({ err: err.message }, 'SPIKE FALHOU: erro durante gravação/decodificação');
        await cleanupAndExit(connection, 1);
      }
    });
  });

  await client.login(env.DISCORD_TOKEN);
}

main().catch((err) => {
  console.error('Erro fatal no spike:', err);
  process.exit(1);
});
