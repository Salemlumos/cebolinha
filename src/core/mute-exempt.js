import { PermissionFlagsBits } from 'discord.js';

/**
 * Usuários com a permissão nativa "Administrator" nunca são silenciados
 * por `/c-mute`, `/c-mute-all` nem pelo painel `/c-call-panel` — evita
 * que um admin silencie outro por engano em ações de massa.
 *
 * Decisão (revista em 2026-09-29): esta checagem é separada da que
 * controla quem pode *usar* os comandos (`ManageGuild`, ver
 * `commands/*.js`). No servidor de teste, um cargo chamado "Administração"
 * tem `ManageGuild` mas não a permissão `Administrator` — usar o mesmo
 * piso para as duas coisas protegia gente que o dono do servidor não
 * queria proteger. `Administrator` é um nível estritamente mais alto,
 * então é preciso conceder explicitamente a quem deve ficar protegido.
 * @param {import('discord.js').GuildMember} member
 * @returns {boolean}
 */
export function isMuteExempt(member) {
  return member.permissions.has(PermissionFlagsBits.Administrator);
}
