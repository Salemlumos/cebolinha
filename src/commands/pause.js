import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { pauseSession } from '../core/session-lifecycle.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-pause')
  .setDescription(c('Pausa a captura de áudio da gravação atual.'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{
 *   sessionManager: ReturnType<typeof import('../core/session-manager.js').createSessionManager>,
 *   recorderRegistry: ReturnType<typeof import('../core/recorder-registry.js').createRecorderRegistry>,
 * }} ctx
 */
export async function execute(interaction, ctx) {
  const result = pauseSession(interaction.guildId, ctx);

  if (!result.ok) {
    await interaction.reply({
      content: `${c('Não há gravação em andamento para pausar. Use')} \`/c-status\` ${c('para ver o estado atual.')}`,
      ephemeral: true,
    });
    return;
  }

  await interaction.reply(`${c('⏸️ Gravação pausada. Novas falas não serão capturadas até o')} \`/c-start\`.`);
}
