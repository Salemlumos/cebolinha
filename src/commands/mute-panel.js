import { ChannelType, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { buildMutePanelComponents } from '../core/mute-panel-components.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-mute-panel')
  .setDescription(c('Abre um painel com botões para mutar/desmutar cada usuário do canal com um clique.'))
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
 */
export async function execute(interaction) {
  const channel = interaction.options.getChannel('canal') ?? interaction.member?.voice?.channel;

  if (!channel) {
    await interaction.reply({
      content: c('Especifique um canal ou entre em um canal de voz antes de usar este comando.'),
      ephemeral: true,
    });
    return;
  }

  const members = [...channel.members.values()].filter((member) => member.id !== interaction.client.user.id);
  if (members.length === 0) {
    await interaction.reply({ content: `${c('Não há ninguém em')} **${channel.name}**.`, ephemeral: true });
    return;
  }

  await interaction.reply({
    content: `🎛️ ${c('Painel de mute de')} **${channel.name}**. ${c('🔊 = livre (clique para mutar) · 🔇 = mutado (clique para desmutar) · 🛡️ = administrador, protegido.')}`,
    components: buildMutePanelComponents(members),
    ephemeral: true,
  });
}
