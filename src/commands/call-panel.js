import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { buildCallPanelComponents } from '../core/call-panel-components.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-call-panel')
  .setDescription(c('Abre um painel para controlar a gravação e mutar/desmutar cada usuário com um clique.'))
  .addChannelOption((option) =>
    option
      .setName('canal')
      .setDescription(c('Canal de voz (padrão: o canal em que você está).'))
      .addChannelTypes(ChannelType.GuildVoice, ChannelType.GuildStageVoice)
      .setRequired(false),
  )
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{ sessionManager: ReturnType<typeof import('../core/session-manager.js').createSessionManager> }} ctx
 */
export async function execute(interaction, { sessionManager }) {
  const channel = interaction.options.getChannel('canal') ?? interaction.member?.voice?.channel;

  if (!channel) {
    await interaction.reply({
      content: c('Especifique um canal ou entre em um canal de voz antes de usar este comando.'),
      ephemeral: true,
    });
    return;
  }

  const members = [...channel.members.values()].filter((member) => member.id !== interaction.client.user.id);
  const sessionState = sessionManager.get(interaction.guildId).state;

  await interaction.reply({
    content: `🎛️ ${c('Painel de')} **${channel.name}**. ${c('🔊 livre · 🔇 mutado · 🛡️ administrador (protegido). A linha de cima controla a gravação.')}`,
    components: buildCallPanelComponents({ sessionState, members }),
    ephemeral: true,
  });
}
