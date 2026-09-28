import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-nickname')
  .setDescription(c('Define um apelido interno do bot para um usuário (usado na transcrição e no /c-status).'))
  .addUserOption((option) => option.setName('usuario').setDescription(c('Usuário.')).setRequired(true))
  .addStringOption((option) => option.setName('apelido').setDescription(c('Apelido a usar.')).setRequired(true))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{ nicknameStore: ReturnType<typeof import('../core/nickname-store.js').createNicknameStore> }} ctx
 */
export async function execute(interaction, { nicknameStore }) {
  const targetUser = interaction.options.getUser('usuario', true);
  const alias = interaction.options.getString('apelido', true);

  nicknameStore.set(interaction.guildId, targetUser.id, alias);

  await interaction.reply(`✏️ <@${targetUser.id}> ${c('agora é identificado como')} "${alias}" ${c('pelo bot.')}`);
}
