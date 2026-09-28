#!/usr/bin/env node
import { AttachmentBuilder, Client, GatewayIntentBits } from 'discord.js';
import { getVoiceConnection, getVoiceConnections } from '@discordjs/voice';
import { loadEnv } from './config/env.js';
import { createLogger } from './utils/logger.js';
import { createSessionManager } from './core/session-manager.js';
import { createRecorderRegistry } from './core/recorder-registry.js';
import { createNicknameStore } from './core/nickname-store.js';
import { finishSession, cancelSession } from './core/session-lifecycle.js';
import { commands } from './commands/index.js';
import { cebolinhaSpeak as c } from './utils/cebolinha-speak.js';

const env = loadEnv();
const logger = createLogger({ level: env.LOG_LEVEL });
const sessionManager = createSessionManager();
const recorderRegistry = createRecorderRegistry();
const nicknameStore = createNicknameStore();

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
    await command.execute(interaction, { sessionManager, recorderRegistry, nicknameStore, env, logger: commandLogger });
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

// --- Fail-safe: desconexão automática por inatividade ---------------------

/** @type {Map<string, NodeJS.Timeout>} */
const emptyChannelTimers = new Map();

function countHumans(channel) {
  return channel.members.filter((member) => !member.user.bot).size;
}

async function notifyTextChannel(guild, textChannelId, payload) {
  if (!textChannelId) return;
  const channel = await guild.channels.fetch(textChannelId).catch(() => null);
  if (!channel) return;
  await channel.send(payload).catch((err) =>
    logger.error({ err: err.message, guildId: guild.id }, 'Falha ao notificar canal de texto após fail-safe'),
  );
}

async function disconnectForInactivity(guildId, guild) {
  emptyChannelTimers.delete(guildId);
  const connection = getVoiceConnection(guildId);
  if (!connection) return;

  const guildLogger = logger.child({ guildId });
  const activeSession = sessionManager.get(guildId);
  const ctx = { sessionManager, recorderRegistry, env, logger: guildLogger };

  if (activeSession.state === 'recording' || activeSession.state === 'paused') {
    const textChannelId = activeSession.textChannelId;
    guildLogger.info({ policy: env.EMPTY_CHANNEL_POLICY }, 'Canal vazio por tempo suficiente, aplicando fail-safe');

    if (env.EMPTY_CHANNEL_POLICY === 'cancel') {
      await cancelSession(guildId, ctx);
      await notifyTextChannel(guild, textChannelId, c('🗑️ Gravação cancelada automaticamente: o canal ficou vazio.'));
    } else {
      const result = await finishSession(guildId, ctx);
      if (result.ok && result.parts) {
        const files = result.parts.map(
          (part, index) =>
            new AttachmentBuilder(Buffer.from(part, 'utf8'), {
              name: result.parts.length > 1 ? `transcricao-parte-${index + 1}.md` : 'transcricao.md',
            }),
        );
        await notifyTextChannel(guild, textChannelId, {
          content: `✅ ${c('Gravação finalizada automaticamente: o canal ficou vazio.')}`,
          files,
        });
      } else {
        await notifyTextChannel(
          guild,
          textChannelId,
          c('⚠️ O canal ficou vazio e tentei finalizar a gravação automaticamente, mas houve um erro. Os áudios foram mantidos.'),
        );
      }
    }
  }

  getVoiceConnection(guildId)?.destroy();
  guildLogger.info('Desconectado por inatividade (fail-safe)');
}

client.on('voiceStateUpdate', (oldState, newState) => {
  const guildId = newState.guild.id;
  const connection = getVoiceConnection(guildId);
  if (!connection) return;

  const botChannelId = connection.joinConfig.channelId;
  if (oldState.channelId !== botChannelId && newState.channelId !== botChannelId) return;

  const channel = newState.guild.channels.cache.get(botChannelId);
  if (!channel) return;

  const existingTimer = emptyChannelTimers.get(guildId);

  if (countHumans(channel) === 0) {
    if (existingTimer) return;
    const timer = setTimeout(() => disconnectForInactivity(guildId, newState.guild), env.EMPTY_CHANNEL_TIMEOUT_MS);
    emptyChannelTimers.set(guildId, timer);
    logger.info({ guildId, channelId: channel.id }, 'Canal ficou vazio, iniciando timer de inatividade');
  } else if (existingTimer) {
    clearTimeout(existingTimer);
    emptyChannelTimers.delete(guildId);
    logger.info({ guildId }, 'Alguém entrou no canal, cancelando desconexão por inatividade');
  }
});

// --- Encerramento gracioso --------------------------------------------------

async function shutdown(signal) {
  logger.info({ signal }, 'Encerrando graciosamente...');
  for (const timer of emptyChannelTimers.values()) clearTimeout(timer);
  for (const connection of getVoiceConnections().values()) {
    connection.destroy();
  }
  client.destroy();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

await client.login(env.DISCORD_TOKEN);
