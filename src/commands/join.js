import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-join')
  .setDescription(c('Conecta o bot a um canal de voz, sem iniciar gravação.'))
  .addChannelOption((option) =>
    option
      .setName('canal')
      .setDescription(c('Canal de voz para conectar.'))
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
      .setRequired(true),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{
 *   sessionManager: ReturnType<typeof import('../core/session-manager.js').createSessionManager>,
 *   logger: import('pino').Logger,
 * }} ctx
 */
export async function execute(interaction, { sessionManager, logger }) {
  const guildId = interaction.guildId;
  const channel = interaction.options.getChannel('canal');

  const activeSession = sessionManager.get(guildId);
  if (activeSession.state === 'recording' || activeSession.state === 'paused') {
    await interaction.reply({
      content: `${c('Há uma gravação em andamento neste servidor. Use')} \`/c-finish\` ${c('ou')} \`/c-cancel\` ${c('antes de trocar de canal.')}`,
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  try {
    const connection = joinVoiceChannel({
      channelId: channel.id,
      guildId,
      adapterCreator: interaction.guild.voiceAdapterCreator,
      selfDeaf: false,
    });
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  } catch (err) {
    logger.error({ err: err.message, guildId }, 'Falha ao conectar em /c-join');
    await interaction.editReply(c('Não consegui conectar nesse canal. Verifique minhas permissões e tente de novo.'));
    return;
  }

  await interaction.editReply(`🔌 ${c('Conectado em')} **${channel.name}**.`);
}
