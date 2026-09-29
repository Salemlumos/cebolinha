import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-unmute')
  .setDescription(c('Remove o silenciamento de um usuário específico.'))
  .addUserOption((option) => option.setName('usuario').setDescription(c('Usuário a dessilenciar.')).setRequired(true))
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
    await member.voice.setMute(false, 'Solicitado via /c-unmute');
  } catch (err) {
    logger.error({ err: err.message, userId: targetUser.id, guildId: interaction.guildId }, 'Falha ao desmutar em /c-unmute');
    await interaction.reply({ content: c('Não consegui remover o silenciamento desse usuário. Verifique minhas permissões.'), ephemeral: true });
    return;
  }

  await interaction.reply(`🔊 <@${targetUser.id}> ${c('não está mais silenciado.')}`);
}
