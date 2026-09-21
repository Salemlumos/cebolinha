import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-mute-all')
  .setDescription(c('Aplica mute de servidor em todos no canal de voz do bot (exceto o bot).'))
  .setDefaultMemberPermissions(PermissionFlagsBits.MuteMembers);

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{ logger: import('pino').Logger }} ctx
 */
export async function execute(interaction, { logger }) {
  const guild = interaction.guild;
  const connection = getVoiceConnection(guild.id);
  if (!connection) {
    await interaction.reply({ content: c('O bot não está em nenhum canal de voz neste servidor.'), ephemeral: true });
    return;
  }

  const botMember = await guild.members.fetchMe();
  if (!botMember.permissions.has(PermissionFlagsBits.MuteMembers)) {
    await interaction.reply({ content: c('Não tenho a permissão "Mute Members" neste servidor.'), ephemeral: true });
    return;
  }

  const channel = guild.channels.cache.get(connection.joinConfig.channelId);
  if (!channel) {
    await interaction.reply({ content: c('Não encontrei o canal de voz do bot.'), ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const targets = [...channel.members.values()].filter((member) => member.id !== botMember.id);
  const failed = [];
  for (const member of targets) {
    try {
      await member.voice.setMute(true, 'Solicitado via /c-mute-all');
    } catch (err) {
      logger.error({ err: err.message, memberId: member.id, guildId: guild.id }, 'Falha ao mutar membro em /c-mute-all');
      failed.push(member);
    }
  }

  const muted = targets.length - failed.length;
  const lines = [`🔇 ${muted} ${c('de')} ${targets.length} ${c('membro(s) mutado(s) em')} **${channel.name}**.`];
  if (failed.length > 0) {
    lines.push(`${c('Não consegui mutar')}: ${failed.map((member) => member.user.tag).join(', ')}.`);
  }
  await interaction.editReply(lines.join('\n'));
}
