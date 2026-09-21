#!/usr/bin/env node
/**
 * Registra os slash commands no Discord. Se `DISCORD_GUILD_ID` estiver
 * definido no `.env`, registra só naquele servidor (rápido, ideal em dev).
 * Caso contrário, registra globalmente (pode levar até 1h para propagar).
 */
import { REST, Routes } from 'discord.js';
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/utils/logger.js';
import { commands } from '../src/commands/index.js';

const env = loadEnv();
const logger = createLogger({ level: env.LOG_LEVEL });

const body = [...commands.values()].map((command) => command.data.toJSON());
const rest = new REST().setToken(env.DISCORD_TOKEN);

const route = env.DISCORD_GUILD_ID
  ? Routes.applicationGuildCommands(env.DISCORD_CLIENT_ID, env.DISCORD_GUILD_ID)
  : Routes.applicationCommands(env.DISCORD_CLIENT_ID);

try {
  const result = await rest.put(route, { body });
  logger.info(
    { count: result.length, scope: env.DISCORD_GUILD_ID ? `guild:${env.DISCORD_GUILD_ID}` : 'global' },
    'Comandos registrados com sucesso',
  );
} catch (err) {
  logger.error({ err: err.message }, 'Falha ao registrar comandos');
  process.exit(1);
}
