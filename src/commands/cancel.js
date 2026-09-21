import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { SlashCommandBuilder } from 'discord.js';
import { getVoiceConnection } from '@discordjs/voice';
import * as session from '../core/session.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

export const data = new SlashCommandBuilder()
  .setName('c-cancel')
  .setDescription(c('Descarta a gravação atual e apaga os áudios, sem transcrever.'));

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{
 *   sessionManager: ReturnType<typeof import('../core/session-manager.js').createSessionManager>,
 *   recorderRegistry: ReturnType<typeof import('../core/recorder-registry.js').createRecorderRegistry>,
 *   env: import('../config/env.js').Env,
 *   logger: import('pino').Logger,
 * }} ctx
 */
export async function execute(interaction, { sessionManager, recorderRegistry, env, logger }) {
  const guildId = interaction.guildId;
  const before = sessionManager.get(guildId);
  const result = session.cancel(before);

  if (!result.success) {
    await interaction.reply({
      content: c('Não há gravação ativa para cancelar.'),
      ephemeral: true,
    });
    return;
  }

  await interaction.deferReply();

  const recorder = recorderRegistry.get(guildId);
  if (recorder) await recorder.stop();
  recorderRegistry.remove(guildId);
  getVoiceConnection(guildId)?.destroy();

  if (before.id) {
    await rm(join(env.DATA_DIR, 'sessions', before.id), { recursive: true, force: true }).catch((err) =>
      logger.error({ err: err.message, guildId }, 'Falha ao apagar áudios da sessão cancelada'),
    );
  }

  sessionManager.remove(guildId);
  await interaction.editReply(`🗑️ ${c('Gravação cancelada e áudios apagados.')}`);
}
