#!/usr/bin/env node
import { Client, GatewayIntentBits } from 'discord.js';
import { getVoiceConnections } from '@discordjs/voice';
import { loadEnv } from './config/env.js';
import { createLogger } from './utils/logger.js';
import { createSessionManager } from './core/session-manager.js';
import { createRecorderRegistry } from './core/recorder-registry.js';
import { commands } from './commands/index.js';
import { cebolinhaSpeak as c } from './utils/cebolinha-speak.js';

const env = loadEnv();
const logger = createLogger({ level: env.LOG_LEVEL });
const sessionManager = createSessionManager();
const recorderRegistry = createRecorderRegistry();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.once('ready', () => {
  logger.info({ user: client.user.tag }, 'Bot pronto');
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) {
    logger.error({ commandName: interaction.commandName }, 'Comando desconhecido recebido');
    await interaction.reply({ content: c('Comando desconhecido.'), ephemeral: true });
    return;
  }

  const commandLogger = logger.child({ guildId: interaction.guildId, command: interaction.commandName });
  try {
    await command.execute(interaction, { sessionManager, recorderRegistry, env, logger: commandLogger });
  } catch (err) {
    commandLogger.error({ err: err.message }, 'Erro não tratado ao executar comando');
    const content = c('Ocorreu um erro inesperado ao executar este comando.');
    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(content).catch(() => {});
    } else {
      await interaction.reply({ content, ephemeral: true }).catch(() => {});
    }
  }
});

client.on('error', (err) => logger.error({ err: err.message }, 'Erro no client do Discord'));

async function shutdown(signal) {
  logger.info({ signal }, 'Encerrando graciosamente...');
  for (const connection of getVoiceConnections().values()) {
    connection.destroy();
  }
  client.destroy();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

await client.login(env.DISCORD_TOKEN);
