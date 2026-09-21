import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import * as session from '../core/session.js';
import { createTranscriber } from '../services/transcriber/index.js';
import { transcribeSegments } from '../services/transcriber/run-batch.js';
import { buildTranscript, splitTranscriptParts } from '../services/formatter.js';

export const data = new SlashCommandBuilder()
  .setName('finish')
  .setDescription('Encerra a gravação, transcreve tudo e posta o resultado no canal.');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{
 *   sessionManager: ReturnType<typeof import('../core/session-manager.js').createSessionManager>,
 *   recorderRegistry: ReturnType<typeof import('../core/recorder-registry.js').createRecorderRegistry>,
 *   env: import('../config/env.js').Env,
 *   logger: import('pino').Logger,
 * }} ctx
 */
export async function execute(interaction, { sessionManager, recorderRegistry, env, logger }) {
  const guildId = interaction.guildId;
  const before = sessionManager.get(guildId);
  const result = session.finish(before);

  if (!result.success) {
    await interaction.reply({
      content: 'Não há gravação ativa para finalizar. Use `/status` para ver o estado atual.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();
  const finishingSession = result.session;
  sessionManager.set(guildId, finishingSession);

  const recorder = recorderRegistry.get(guildId);
  if (recorder) await recorder.stop();
  recorderRegistry.remove(guildId);
  getVoiceConnection(guildId)?.destroy();

  if (finishingSession.segments.length === 0) {
    sessionManager.remove(guildId);
    await interaction.editReply('Gravação encerrada, mas nenhuma fala foi capturada — nada para transcrever.');
    return;
  }

  let transcript;
  try {
    const transcriber = createTranscriber(env);
    const transcribed = await transcribeSegments(transcriber, finishingSession.segments, {
      concurrency: env.TRANSCRIBE_CONCURRENCY,
      language: env.TRANSCRIBE_LANGUAGE,
    });
    const sessionEndedAt = new Date();
    const participantNames = new Map(transcribed.map((seg) => [seg.userId, seg.displayName]));

    transcript = buildTranscript({
      segments: transcribed,
      sessionStartedAt: finishingSession.startedAt,
      sessionEndedAt,
      participants: [...finishingSession.speakerIds].map((id) => participantNames.get(id) ?? id),
    });
  } catch (err) {
    logger.error({ err: err.message, guildId }, 'Falha ao transcrever sessão em /finish');
    sessionManager.set(guildId, session.complete(finishingSession).session);
    await interaction.editReply(
      'Encerrei a gravação, mas houve um erro ao transcrever. Os áudios foram mantidos em disco para uma nova tentativa manual.',
    );
    return;
  }

  const parts = splitTranscriptParts(transcript);
  const files = parts.map(
    (part, index) =>
      new AttachmentBuilder(Buffer.from(part, 'utf8'), {
        name: parts.length > 1 ? `transcricao-parte-${index + 1}.md` : 'transcricao.md',
      }),
  );

  sessionManager.set(guildId, session.complete(finishingSession).session);
  await interaction.editReply({ content: '✅ Gravação finalizada. Transcrição em anexo.', files });

  if (!env.KEEP_AUDIO) {
    await rm(join(env.DATA_DIR, 'sessions', finishingSession.id), { recursive: true, force: true }).catch((err) =>
      logger.error({ err: err.message, guildId }, 'Falha ao apagar áudios após /finish'),
    );
  }

  sessionManager.remove(guildId);
}
