import * as status from './status.js';
import * as join from './join.js';
import * as leave from './leave.js';
import * as call from './call.js';
import * as disconnect from './disconnect.js';
import * as pullAll from './pull-all.js';
import * as moveAll from './move-all.js';
import * as nickname from './nickname.js';
import * as mute from './mute.js';
import * as unmute from './unmute.js';
import * as muteAll from './mute-all.js';
import * as unmuteAll from './unmute-all.js';
import * as callPanel from './call-panel.js';

/**
 * Todos os comandos slash disponíveis, indexados pelo nome declarado em
 * `data`. Cada módulo exporta `{ data, execute }`.
 *
 * `/c-start`, `/c-pause`, `/c-finish` e `/c-cancel` deixaram de existir
 * como comandos separados: são 100% redundantes com a linha de controle
 * de gravação do `/c-call-panel` (mesma lógica, em `session-lifecycle.js`)
 * — manter os dois só dava dois jeitos de fazer a mesma coisa. `/c-status`
 * continua existindo por conta própria: mostra duração/segmentos/quem
 * falou, informação que o painel não exibe.
 * @type {Map<string, { data: import('discord.js').SlashCommandBuilder, execute: Function }>}
 */
export const commands = new Map(
  [status, join, leave, call, disconnect, pullAll, moveAll, nickname, mute, unmute, muteAll, unmuteAll, callPanel].map(
    (command) => [command.data.name, command],
  ),
);
