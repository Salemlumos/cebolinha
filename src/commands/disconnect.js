import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-disconnect')
  .setDescription(c('Expulsa um usuário da chamada de voz em que estiver.'))
  .addUserOption((option) => option.setName('usuario').setDescription(c('Usuário a desconectar.')).setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{ logger: import('pino').Logger }} ctx
 */
export async function execute(interaction, { logger }) {
  const targetUser = interaction.options.getUser('usuario', true);

  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!member?.voice.channelId) {
    await interaction.reply({ content: c('Esse usuário não está em nenhum canal de voz.'), ephemeral: true });
    return;
  }

  try {
    await member.voice.disconnect('Solicitado via /c-disconnect');
  } catch (err) {
    logger.error(
      { err: err.message, userId: targetUser.id, guildId: interaction.guildId },
      'Falha ao desconectar usuário em /c-disconnect',
    );
    await interaction.reply({ content: c('Não consegui desconectar esse usuário. Verifique minhas permissões.'), ephemeral: true });
    return;
  }

  await interaction.reply(`👋 <@${targetUser.id}> ${c('foi desconectado da chamada.')}`);
}
