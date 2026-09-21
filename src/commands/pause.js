import { SlashCommandBuilder } from 'discord.js';
import * as session from '../core/session.js';

export const data = new SlashCommandBuilder()
  .setName('pause')
  .setDescription('Pausa a captura de áudio da gravação atual.');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{
 *   sessionManager: ReturnType<typeof import('../core/session-manager.js').createSessionManager>,
 *   recorderRegistry: ReturnType<typeof import('../core/recorder-registry.js').createRecorderRegistry>,
 * }} ctx
 */
export async function execute(interaction, { sessionManager, recorderRegistry }) {
  const guildId = interaction.guildId;
  const result = session.pause(sessionManager.get(guildId));

  if (!result.success) {
    await interaction.reply({
      content: 'Não há gravação em andamento para pausar. Use `/status` para ver o estado atual.',
      ephemeral: true,
    });
    return;
  }

  sessionManager.set(guildId, result.session);
  recorderRegistry.get(guildId)?.pause();
  await interaction.reply('⏸️ Gravação pausada. Novas falas não serão capturadas até o `/resume`.');
}
