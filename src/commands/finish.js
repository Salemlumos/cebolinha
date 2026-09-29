import { SlashCommandBuilder, AttachmentBuilder, PermissionFlagsBits } from 'discord.js';
import { finishSession } from '../core/session-lifecycle.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-finish')
  .setDescription(c('Encerra a gravação, transcreve tudo e posta o resultado no canal.'))
  .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild);

function buildAttachments(parts) {
  return parts.map(
    (part, index) =>
      new AttachmentBuilder(Buffer.from(part, 'utf8'), {
        name: parts.length > 1 ? `transcricao-parte-${index + 1}.md` : 'transcricao.md',
      }),
  );
}

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{
 *   sessionManager: ReturnType<typeof import('../core/session-manager.js').createSessionManager>,
 *   recorderRegistry: ReturnType<typeof import('../core/recorder-registry.js').createRecorderRegistry>,
 *   env: import('../config/env.js').Env,
 *   logger: import('pino').Logger,
 * }} ctx
 */
export async function execute(interaction, ctx) {
  await interaction.deferReply();
  const result = await finishSession(interaction.guildId, ctx);

  if (!result.ok) {
    const message =
      result.code === 'not-recording'
        ? `${c('Não há gravação ativa para finalizar. Use')} \`/c-status\` ${c('para ver o estado atual.')}`
        : c('Encerrei a gravação, mas houve um erro ao transcrever. Os áudios foram mantidos em disco para uma nova tentativa manual.');
    await interaction.editReply(message);
    return;
  }

  if (result.emptyMessage) {
    await interaction.editReply(c('Gravação encerrada, mas nenhuma fala foi capturada — nada para transcrever.'));
    return;
  }

  await interaction.editReply({
    content: `✅ ${c('Gravação finalizada. Transcrição em anexo.')}`,
    files: buildAttachments(result.parts),
  });
}
