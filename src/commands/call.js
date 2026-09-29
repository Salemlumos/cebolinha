import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-call')
  .setDescription(c('Move um usuário para um canal de voz específico.'))
  .addUserOption((option) => option.setName('usuario').setDescription(c('Usuário a mover.')).setRequired(true))
  .addChannelOption((option) =>
    option
      .setName('canal')
      .setDescription(c('Canal de voz de destino.'))
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{ logger: import('pino').Logger }} ctx
 */
export async function execute(interaction, { logger }) {
  const targetUser = interaction.options.getUser('usuario', true);
  const channel = interaction.options.getChannel('canal', true);

  const member = await interaction.guild.members.fetch(targetUser.id).catch(() => null);
  if (!member?.voice.channelId) {
    await interaction.reply({
      content: c('Esse usuário precisa estar em um canal de voz para ser movido.'),
      ephemeral: true,
    });
    return;
  }

  try {
    await member.voice.setChannel(channel.id, 'Solicitado via /c-call');
  } catch (err) {
    logger.error({ err: err.message, userId: targetUser.id, guildId: interaction.guildId }, 'Falha ao mover usuário em /c-call');
    await interaction.reply({ content: c('Não consegui mover esse usuário. Verifique minhas permissões.'), ephemeral: true });
    return;
  }

  await interaction.reply(`📞 <@${targetUser.id}> ${c('movido para')} **${channel.name}**.`);
}
