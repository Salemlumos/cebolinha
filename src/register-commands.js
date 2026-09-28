import { REST, Routes } from 'discord.js';
import { commands } from './commands/index.js';

/**
 * Registra (PUT, sobrescreve o conjunto inteiro) os slash commands no
 * Discord. Se `env.DISCORD_GUILD_ID` estiver definido, registra só nesse
 * servidor (rápido, ideal em dev). Caso contrário, registra globalmente
 * (pode levar até 1h pra propagar na primeira vez; depois disso é
 * instantâneo e cobre qualquer servidor novo onde o bot for adicionado).
 * Idempotente — seguro rodar em todo boot do bot.
 * @param {import('./config/env.js').Env} env
 * @param {import('pino').Logger} logger
 * @returns {Promise<{ count: number, scope: string }>}
 */
export async function registerCommands(env, logger) {
  const body = [...commands.values()].map((command) => command.data.toJSON());
  const rest = new REST().setToken(env.DISCORD_TOKEN);

  const route = env.DISCORD_GUILD_ID
    ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID)
    : Routes.applicationCommands(env.DISCORD_CLIENT_ID);

  const result = await rest.put(route, { body });
  const scope = env.DISCORD_GUILD_ID ? `guild:${env.DISCORD_GUILD_ID}` : 'global';
  logger.info({ count: result.length, scope }, 'Comandos registrados com sucesso');
  return { count: result.length, scope };
}
