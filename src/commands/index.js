import * as start from './start.js';
import * as pause from './pause.js';
import * as status from './status.js';
import * as finish from './finish.js';
import * as cancel from './cancel.js';
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
 * @type {Map<string, { data: import('discord.js').SlashCommandBuilder, execute: Function }>}
 */
export const commands = new Map(
  [
    start,
    pause,
    status,
    finish,
    cancel,
    join,
    leave,
    call,
    disconnect,
    pullAll,
    moveAll,
    nickname,
    mute,
    unmute,
    muteAll,
    unmuteAll,
    callPanel,
  ].map((command) => [command.data.name, command]),
);
