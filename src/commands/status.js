import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { cebolinhaSpeak as c } from '../utils/cebolinha-speak.js';

const STATE_LABELS = {
  idle: c('nenhuma gravação ativa'),
  recording: `🔴 ${c('gravando')}`,
  paused: `⏸️ ${c('pausada')}`,
  finishing: `⏳ ${c('finalizando')}`,
  done: `✅ ${c('concluída')}`,
  cancelled: `❌ ${c('cancelada')}`,
};

function formatDuration(session) {
  if (!session.startedAt) return '—';
  const end = session.endedAt ?? new Date();
  const totalSeconds = Math.max(0, Math.floor((end.getTime() - session.startedAt.getTime()) / 1000));
  const hours = String(Math.floor(totalSeconds / 3600)).padStart(2, '0');
  const minutes = String(Math.floor((totalSeconds % 3600) / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${hours}:${minutes}:${seconds}`;
}

export const data = new SlashCommandBuilder()
  .setName('c-status')
  .setDescription(c('Mostra o estado atual da gravação neste servidor.'))
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator);

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{ sessionManager: ReturnType<typeof import('../core/session-manager.js').createSessionManager> }} ctx
 */
export async function execute(interaction, { sessionManager }) {
  const session = sessionManager.get(interaction.guildId);

  if (session.state === 'idle') {
    await interaction.reply({
      content: `${c('Nenhuma gravação ativa neste servidor. Use')} \`/c-start\` ${c('para começar.')}`,
      ephemeral: true,
    });
    return;
  }

  const speakers = [...session.speakerIds];
  const lines = [
    `${c('Estado')}: ${STATE_LABELS[session.state] ?? session.state}`,
    `${c('Duração')}: ${formatDuration(session)}`,
    `${c('Segmentos capturados')}: ${session.segments.length}`,
    `${c('Participantes que já falaram')}: ${speakers.length > 0 ? speakers.map((id) => `<@${id}>`).join(', ') : c('ninguém ainda')}`,
  ];

  await interaction.reply(lines.join('\n'));
}
