import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { isMuteExempt } from './mute-exempt.js';

export const MUTE_TOGGLE_PREFIX = 'c-mute-toggle';
export const RECORDING_START_ID = 'c-panel-start';
export const RECORDING_PAUSE_ID = 'c-panel-pause';
export const RECORDING_FINISH_ID = 'c-panel-finish';

const BUTTONS_PER_ROW = 5;
const MAX_MUTE_BUTTONS = 20; // 1 linha pra gravação + até 4 linhas de mute = 25 (limite do Discord)

/**
 * Linha de controle da gravação: Iniciar/Retomar, Pausar, Finalizar. O
 * rótulo e o que fica desabilitado dependem do estado atual da sessão.
 * @param {import('./session.js').SessionState} sessionState
 * @returns {import('discord.js').ActionRowBuilder}
 */
export function buildRecordingControlsRow(sessionState) {
  const isRecording = sessionState === 'recording';
  const isPaused = sessionState === 'paused';
  const isActive = isRecording || isPaused;
  const canStartOrResume = sessionState === 'idle' || isPaused;

  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(RECORDING_START_ID)
      .setLabel(isPaused ? '▶️ Retomar' : '🔴 Iniciar')
      .setStyle(ButtonStyle.Success)
      .setDisabled(!canStartOrResume),
    new ButtonBuilder()
      .setCustomId(RECORDING_PAUSE_ID)
      .setLabel('⏸️ Pausar')
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(!isRecording),
    new ButtonBuilder()
      .setCustomId(RECORDING_FINISH_ID)
      .setLabel('⏹️ Finalizar')
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!isActive),
  );
}

/**
 * Linhas de mute: um botão por membro, agrupados em linhas de até 5.
 * @param {import('discord.js').GuildMember[]} members
 * @returns {import('discord.js').ActionRowBuilder[]}
 */
export function buildMuteButtonRows(members) {
  const limited = members.slice(0, MAX_MUTE_BUTTONS);
  const rows = [];

  for (let i = 0; i < limited.length; i += BUTTONS_PER_ROW) {
    const row = new ActionRowBuilder();
    for (const member of limited.slice(i, i + BUTTONS_PER_ROW)) {
      const exempt = isMuteExempt(member);
      const muted = Boolean(member.voice.serverMute);
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`${MUTE_TOGGLE_PREFIX}:${member.id}`)
          .setDisabled(exempt)
          .setLabel(exempt ? `🛡️ ${member.displayName}` : muted ? `🔇 ${member.displayName}` : `🔊 ${member.displayName}`)
          .setStyle(exempt ? ButtonStyle.Secondary : muted ? ButtonStyle.Danger : ButtonStyle.Success),
      );
    }
    rows.push(row);
  }

  return rows;
}

/**
 * Painel completo: linha de gravação + linhas de mute. Usado tanto para
 * criar a mensagem do `/c-call-panel` quanto para reconstruí-la após
 * qualquer clique (o painel nunca rastreia entradas/saídas do canal
 * dinamicamente — só reflete o estado atual de quem já está nos botões).
 * @param {Object} params
 * @param {import('./session.js').SessionState} params.sessionState
 * @param {import('discord.js').GuildMember[]} params.members
 * @returns {import('discord.js').ActionRowBuilder[]}
 */
export function buildCallPanelComponents({ sessionState, members }) {
  return [buildRecordingControlsRow(sessionState), ...buildMuteButtonRows(members)];
}
