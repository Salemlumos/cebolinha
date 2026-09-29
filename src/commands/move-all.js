import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-move-all')
  .setDescription(c('Transfere todos os usuários de um canal de voz para outro canal de voz.'))
  .addChannelOption((option) =>
    option
      .setName('canal_origem')
      .setDescription(c('Canal de voz de onde mover os usuários.'))
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
      .setRequired(true),
  )
  .addChannelOption((option) =>
    option
      .setName('canal_destino')
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
  const sourceChannel = interaction.options.getChannel('canal_origem', true);
  const destinationChannel = interaction.options.getChannel('canal_destino', true);

  await interaction.deferReply();

  const targets = [...sourceChannel.members.values()];
  const failed = [];
  for (const member of targets) {
    try {
      await member.voice.setChannel(destinationChannel.id, 'Solicitado via /c-move-all');
    } catch (err) {
      logger.error(
        { err: err.message, memberId: member.id, guildId: interaction.guildId },
        'Falha ao mover membro em /c-move-all',
      );
      failed.push(member);
    }
  }

  const moved = targets.length - failed.length;
  const lines = [
    `📤 ${moved} ${c('de')} ${targets.length} ${c('usuário(s) movido(s) de')} **${sourceChannel.name}** ${c('para')} **${destinationChannel.name}**.`,
  ];
  if (failed.length > 0) {
    lines.push(`${c('Não consegui mover')}: ${failed.map((member) => member.user.tag).join(', ')}.`);
  }
  await interaction.editReply(lines.join('\n'));
}
