import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import * as session from '../core/session.js';
import { createRecorder } from '../core/recorder.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-start')
  .setDescription(c('Inicia a gravação (ou retoma, se estiver pausada) no canal onde o bot já está.'))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

async function resolveDisplayName(guild, nicknameStore, userId) {
  const alias = nicknameStore.get(guild.id, userId);
  if (alias) return alias;
  const cached = guild.members.cache.get(userId);
  if (cached) return cached.displayName;
  try {
    const fetched = await guild.members.fetch(userId);
    return fetched.displayName;
  } catch {
    return userId;
  }
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{
 *   sessionManager: ReturnType<typeof import('../core/session-manager.js').createSessionManager>,
 *   recorderRegistry: ReturnType<typeof import('../core/recorder-registry.js').createRecorderRegistry>,
 *   nicknameStore: ReturnType<typeof import('../core/nickname-store.js').createNicknameStore>,
 *   env: import('../config/env.js').Env,
 *   logger: import('pino').Logger,
 * }} ctx
 */
export async function execute(interaction, { sessionManager, recorderRegistry, nicknameStore, env, logger }) {
  const guildId = interaction.guildId;
  const connection = getVoiceConnection(guildId);
  if (!connection) {
    await interaction.reply({
      content: `${c('O bot precisa estar conectado a um canal de voz. Use')} \`/c-join\` ${c('primeiro.')}`,
      ephemeral: true,
    });
    return;
  }

  const current = sessionManager.get(guildId);

  if (current.state === 'paused') {
    const result = session.resume(current);
    sessionManager.set(guildId, result.session);
    recorderRegistry.get(guildId)?.resume();
    await interaction.reply(c('▶️ Gravação retomada.'));
    return;
  }

  const result = session.start(current, {
    voiceChannelId: connection.joinConfig.channelId,
    textChannelId: interaction.channelId,
    startedBy: interaction.user.id,
  });

  if (!result.success) {
    await interaction.reply({
      content: `${c('Já existe uma gravação em andamento neste servidor. Use')} \`/c-status\` ${c('para ver o estado atual.')}`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();
  sessionManager.set(guildId, result.session);

  const channel = interaction.guild.channels.cache.get(connection.joinConfig.channelId);
  const recorder = createRecorder({
    connection,
    sessionId: result.session.id,
    dataDir: env.DATA_DIR,
    silenceMs: env.SILENCE_MS,
    minSegmentMs: env.MIN_SEGMENT_MS,
    resolveDisplayName: (userId) => resolveDisplayName(interaction.guild, nicknameStore, userId),
    logger,
    onSegment(segment) {
      const active = sessionManager.get(guildId);
      active.segments.push(segment);
      active.speakerIds.add(segment.userId);
    },
  });
  recorderRegistry.set(guildId, recorder);

  await interaction.editReply(
    `${c('🔴 Gravando esta call em')} **${channel?.name ?? connection.joinConfig.channelId}**. ${c('Avisem quem ainda não sabia que a conversa está sendo registrada. Use')} \`/c-finish\` ${c('para encerrar e gerar a transcrição, ou')} \`/c-cancel\` ${c('para descartar.')}`,
  );
}
