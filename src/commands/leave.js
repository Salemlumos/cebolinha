import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-leave')
  .setDescription(c('Desconecta o bot do canal de voz atual.'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{ sessionManager: ReturnType<typeof import('../core/session-manager.js').createSessionManager> }} ctx
 */
export async function execute(interaction, { sessionManager }) {
  const guildId = interaction.guildId;

  const activeSession = sessionManager.get(guildId);
  if (activeSession.state === 'recording' || activeSession.state === 'paused') {
    await interaction.reply({
      content: `${c('Há uma gravação em andamento neste servidor. Use')} \`/c-finish\` ${c('ou')} \`/c-cancel\` ${c('antes de desconectar.')}`,
      ephemeral: true,
    });
    return;
  }

  const connection = getVoiceConnection(guildId);
  if (!connection) {
    await interaction.reply({ content: c('O bot não está conectado a nenhum canal de voz neste servidor.'), ephemeral: true });
    return;
  }

  connection.destroy();
  await interaction.reply(c('👋 Desconectado do canal de voz.'));
}
