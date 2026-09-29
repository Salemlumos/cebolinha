import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { isMuteExempt } from './mute-exempt.js';

export const MUTE_TOGGLE_PREFIX = 'c-mute-toggle';
const MAX_BUTTONS = 25; // limite do Discord: 5 linhas x 5 botões
const BUTTONS_PER_ROW = 5;

/**
 * Monta os botões do painel de mute: um por membro, refletindo o estado
 * atual (mutado/livre) e desabilitado (com cadeado) para quem é isento
 * (`isMuteExempt`). Usado tanto ao criar o painel quanto ao atualizá-lo
 * depois de um clique.
 * @param {import('discord.js').GuildMember[]} members
 * @returns {import('discord.js').ActionRowBuilder[]}
 */
export function buildMutePanelComponents(members) {
  const limited = members.slice(0, MAX_BUTTONS);
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
