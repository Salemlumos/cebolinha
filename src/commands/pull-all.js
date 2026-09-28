import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-pull-all')
  .setDescription(c('Traz todos os usuários de um canal de voz para o canal em que você está.'))
  .addChannelOption((option) =>
    option
      .setName('canal_origem')
      .setDescription(c('Canal de voz de onde puxar os usuários.'))
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{ logger: import('pino').Logger }} ctx
 */
export async function execute(interaction, { logger }) {
  const sourceChannel = interaction.options.getChannel('canal_origem', true);
  const destinationChannel = interaction.member?.voice?.channel;

  if (!destinationChannel) {
    await interaction.reply({
      content: c('Você precisa estar em um canal de voz para usar este comando (é o destino).'),
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const targets = [...sourceChannel.members.values()];
  const failed = [];
  for (const member of targets) {
    try {
      await member.voice.setChannel(destinationChannel.id, 'Solicitado via /c-pull-all');
    } catch (err) {
      logger.error(
        { err: err.message, memberId: member.id, guildId: interaction.guildId },
        'Falha ao mover membro em /c-pull-all',
      );
      failed.push(member);
    }
  }

  const moved = targets.length - failed.length;
  const lines = [
    `📥 ${moved} ${c('de')} ${targets.length} ${c('usuário(s) movido(s) de')} **${sourceChannel.name}** ${c('para')} **${destinationChannel.name}**.`,
  ];
  if (failed.length > 0) {
    lines.push(`${c('Não consegui mover')}: ${failed.map((member) => member.user.tag).join(', ')}.`);
  }
  await interaction.editReply(lines.join('\n'));
}
