import { SlashCommandBuilder } from 'discord.js';

const STATE_LABELS = {
  idle: 'nenhuma gravação ativa',
  recording: '🔴 gravando',
  paused: '⏸️ pausada',
  finishing: '⏳ finalizando',
  done: '✅ concluída',
  cancelled: '❌ cancelada',
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
  .setName('status')
  .setDescription('Mostra o estado atual da gravação neste servidor.');

/**
 * @param {import('discord.js').ChatInputCommandInteraction} interaction
 * @param {{ sessionManager: import('../core/session-manager.js').ReturnType }} ctx
 */
export async function execute(interaction, { sessionManager }) {
  const session = sessionManager.get(interaction.guildId);

  if (session.state === 'idle') {
    await interaction.reply({ content: 'Nenhuma gravação ativa neste servidor. Use `/start` para começar.', ephemeral: true });
    return;
  }

  const speakers = [...session.speakerIds];
  const lines = [
    `Estado: ${STATE_LABELS[session.state] ?? session.state}`,
    `Duração: ${formatDuration(session)}`,
    `Segmentos capturados: ${session.segments.length}`,
    `Participantes que já falaram: ${speakers.length > 0 ? speakers.map((id) => `<@${id}>`).join(', ') : 'ninguém ainda'}`,
  ];

  await interaction.reply(lines.join('\n'));
}
