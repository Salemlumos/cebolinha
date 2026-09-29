import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { startOrResumeSession } from '../core/session-lifecycle.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-start')
  .setDescription(c('Inicia a gravação (ou retoma, se estiver pausada) no canal onde o bot já está.'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

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
export async function execute(interaction, ctx) {
  const guildId = interaction.guildId;
  const connection = getVoiceConnection(guildId);
  if (!connection) {
    await interaction.reply({
      content: `${c('O bot precisa estar conectado a um canal de voz. Use')} \`/c-join\` ${c('primeiro.')}`,
      ephemeral: true,
    });
    return;
  }

  const wasPaused = ctx.sessionManager.get(guildId).state === 'paused';
  const result = startOrResumeSession(guildId, {
    ...ctx,
    connection,
    guild: interaction.guild,
    textChannelId: interaction.channelId,
    startedBy: interaction.user.id,
  });

  if (!result.ok) {
    await interaction.reply({
      content: `${c('Já existe uma gravação em andamento neste servidor. Use')} \`/c-status\` ${c('para ver o estado atual.')}`,
      ephemeral: true,
    });
    return;
  }

  if (wasPaused) {
    await interaction.reply(c('▶️ Gravação retomada.'));
    return;
  }

  const channel = interaction.guild.channels.cache.get(connection.joinConfig.channelId);
  await interaction.reply(
    `${c('🔴 Gravando esta call em')} **${channel?.name ?? connection.joinConfig.channelId}**. ${c('Avisem quem ainda não sabia que a conversa está sendo registrada. Use')} \`/c-finish\` ${c('para encerrar e gerar a transcrição, ou')} \`/c-cancel\` ${c('para descartar.')}`,
  );
}
