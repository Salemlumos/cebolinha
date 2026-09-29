import { PermissionFlagsBits } from 'discord.js';

/**
 * Usuários com a permissão que já usamos como piso de acesso aos comandos
 * (Manage Server) nunca são silenciados por `/c-mute`, `/c-mute-all` nem
 * pelo painel `/c-mute-panel` — evita que um admin silencie outro admin
 * por engano em ações de massa.
 * @param {import('discord.js').GuildMember} member
 * @returns {boolean}
 */
export function isMuteExempt(member) {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}
