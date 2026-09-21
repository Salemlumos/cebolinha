import { SlashCommandBuilder } from 'discord.js';
import { joinVoiceChannel, VoiceConnectionStatus, entersState } from '@discordjs/voice';
import * as session from '../core/session.js';

export const data = new SlashCommandBuilder()
  .setName('start')
  .setDescription('Inicia a gravação da call de voz atual (avisa todos no canal).');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{ sessionManager: import('../core/session-manager.js').ReturnType, logger: import('pino').Logger }} ctx
 */
export async function execute(interaction, { sessionManager, logger }) {
  const voiceChannel = interaction.member?.voice?.channel;
  if (!voiceChannel) {
    await interaction.reply({
      content: 'Você precisa estar em um canal de voz para usar `/start`.',
      ephemeral: true,
    });
    return;
  }

  const guildId = interaction.guildId;
  const current = sessionManager.get(guildId);
  const result = session.start(current, {
    voiceChannelId: voiceChannel.id,
    textChannelId: interaction.channelId,
    startedBy: interaction.user.id,
  });

  if (!result.success) {
    await interaction.reply({
      content: 'Já existe uma gravação em andamento neste servidor. Use `/status` para ver o estado atual.',
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();
  sessionManager.set(guildId, result.session);

  try {
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
    });
    await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
  } catch (err) {
    logger.error({ err: err.message, guildId }, 'Falha ao entrar no canal de voz em /start');
    sessionManager.remove(guildId);
    await interaction.editReply('Não consegui entrar no canal de voz. Verifique minhas permissões e tente de novo.');
    return;
  }

  await interaction.editReply(
    `🔴 **Gravando esta call.** Entrei em **${voiceChannel.name}** — avisem quem ainda não sabia que a conversa está sendo registrada. Use \`/finish\` para encerrar e gerar a transcrição, ou \`/cancel\` para descartar.`,
  );
}
