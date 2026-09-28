import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { cancelSession } from '../core/session-lifecycle.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-cancel')
  .setDescription(c('Descarta a gravação atual e apaga os áudios, sem transcrever.'))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{
 *   sessionManager: ReturnType<typeof import('../core/session-manager.js').createSessionManager>,
 *   recorderRegistry: ReturnType<typeof import('../core/recorder-registry.js').createRecorderRegistry>,
 *   env: import('../config/env.js').Env,
 *   logger: import('pino').Logger,
 * }} ctx
 */
export async function execute(interaction, ctx) {
  await interaction.deferReply();
  const result = await cancelSession(interaction.guildId, ctx);

  if (!result.ok) {
    await interaction.editReply(c('Não há gravação ativa para cancelar.'));
    return;
  }

  await interaction.editReply(`🗑️ ${c('Gravação cancelada e áudios apagados.')}`);
}
