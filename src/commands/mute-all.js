import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { isMuteExempt } from '../core/mute-exempt.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-mute-all')
  .setDescription(c('Aplica mute de servidor em todos de um canal de voz (administradores ficam de fora).'))
  .addChannelOption((option) =>
    option
      .setName('canal')
      .setDescription(c('Canal de voz.'))
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{ logger: import('pino').Logger }} ctx
 */
export async function execute(interaction, { logger }) {
  const channel = interaction.options.getChannel('canal', true);
  const botMember = await interaction.guild.members.fetchMe();

  if (!botMember.permissions.has(PermissionFlagsBits.MuteMembers)) {
    await interaction.reply({ content: c('Não tenho a permissão "Mute Members" neste servidor.'), ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const allMembers = [...channel.members.values()].filter((member) => member.id !== botMember.id);
  const exempt = allMembers.filter((member) => isMuteExempt(member));
  const targets = allMembers.filter((member) => !isMuteExempt(member));
  const failed = [];
  for (const member of targets) {
    try {
      await member.voice.setMute(true, 'Solicitado via /c-mute-all');
    } catch (err) {
      logger.error(
        { err: err.message, memberId: member.id, guildId: interaction.guildId },
        'Falha ao mutar membro em /c-mute-all',
      );
      failed.push(member);
    }
  }

  const muted = targets.length - failed.length;
  const lines = [`🔇 ${muted} ${c('de')} ${targets.length} ${c('membro(s) mutado(s) em')} **${channel.name}**.`];
  if (exempt.length > 0) {
    lines.push(`${c('Protegido(s) por serem administradores')}: ${exempt.map((member) => member.user.tag).join(', ')}.`);
  }
  if (failed.length > 0) {
    lines.push(`${c('Não consegui mutar')}: ${failed.map((member) => member.user.tag).join(', ')}.`);
  }
  await interaction.editReply(lines.join('\n'));
}
