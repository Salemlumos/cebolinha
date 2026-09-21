import * as start from './start.js';
import * as pause from './pause.js';
import * as resume from './resume.js';
import * as status from './status.js';
import * as finish from './finish.js';
import * as cancel from './cancel.js';
import * as muteAll from './mute-all.js';
import * as unmuteAll from './unmute-all.js';

/**
 * Todos os comandos slash disponíveis nesta fase, indexados pelo nome
 * declarado em `data`. Cada módulo exporta `{ data, execute }`.
 * @type {Map<string, { data: import('discord.js').SlashCommandBuilder, execute: Function }>}
 */
export const commands = new Map(
  [start, pause, resume, status, finish, cancel, muteAll, unmuteAll].map((command) => [command.data.name, command]),
);
