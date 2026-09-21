import { SlashCommandBuilder } from 'discord.js';
import * as session from '../core/session.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-resume')
  .setDescription(c('Retoma a captura de áudio de uma gravação pausada.'));

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{
 *   sessionManager: ReturnType<typeof import('../core/session-manager.js').createSessionManager>,
 *   recorderRegistry: ReturnType<typeof import('../core/recorder-registry.js').createRecorderRegistry>,
 * }} ctx
 */
export async function execute(interaction, { sessionManager, recorderRegistry }) {
  const guildId = interaction.guildId;
  const result = session.resume(sessionManager.get(guildId));

  if (!result.success) {
    await interaction.reply({
      content: `${c('Não há gravação pausada para retomar. Use')} \`/c-status\` ${c('para ver o estado atual.')}`,
      ephemeral: true,
    });
    return;
  }

  sessionManager.set(guildId, result.session);
  recorderRegistry.get(guildId)?.resume();
  await interaction.reply(c('▶️ Gravação retomada.'));
}
