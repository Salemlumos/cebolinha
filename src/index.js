#!/usr/bin/env node
import { join } from 'node:path';
import { AttachmentBuilder, Client, GatewayIntentBits } from 'discord.js';
import { getVoiceConnection, getVoiceConnections } from '@discordjs/voice';
import { loadEnv } from './config/env.js';
import { createLogger } from './utils/logger.js';
import { createSessionManager } from './core/session-manager.js';
import { createRecorderRegistry } from './core/recorder-registry.js';
import { createNicknameStore } from './core/nickname-store.js';
import { finishSession, cancelSession, startOrResumeSession, pauseSession } from './core/session-lifecycle.js';
import { commands } from './commands/index.js';
import { registerCommands } from './register-commands.js';
import { printBanner } from './utils/banner.js';
import { isMuteExempt } from './core/mute-exempt.js';
import {
  buildCallPanelComponents,
  buildRecordingControlsRow,
  buildMuteButtonRows,
  buildPanelEmbed,
  MUTE_TOGGLE_PREFIX,
  RECORDING_START_ID,
  RECORDING_PAUSE_ID,
  RECORDING_FINISH_ID,
  RECORDING_CANCEL_ID,
} from './core/call-panel-components.js';
import { cebolinhaSpeak as c } from './utils/cebolinha-speak.js';

printBanner();

const env = loadEnv();
const logger = createLogger({ level: env.LOG_LEVEL, pretty: process.env.NODE_ENV !== 'production' });
const sessionManager = createSessionManager();
const recorderRegistry = createRecorderRegistry();
const nicknameStore = createNicknameStore(join(env.DATA_DIR, 'nicknames.json'));

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildVoiceStates],
});

client.once('ready', async () => {
  logger.info({ user: client.user.tag }, 'Bot pronto');
  try {
    await registerCommands(env, logger);
  } catch (err) {
    logger.error({ err: err.message }, 'Falha ao registrar comandos automaticamente no boot');
  }
});

/**
 * Refaz a lista de membros do painel a partir do que já está nos botões
 * da mensagem — nunca consulta quem está no canal de voz agora. Entradas
 * e saídas do canal depois de o painel ter sido aberto não são
 * refletidas (decisão deliberada, não é um caso que este painel precisa
 * cobrir).
 * @param {import('discord.js').ButtonInteraction} interaction
 * @returns {Promise<import('discord.js').GuildMember[]>}
 */
async function getPanelMembers(interaction) {
  const panelUserIds = interaction.message.components
    .flatMap((row) => row.components)
    .filter((component) => component.customId?.startsWith(`${MUTE_TOGGLE_PREFIX}:`))
    .map((component) => component.customId.slice(MUTE_TOGGLE_PREFIX.length + 1));

  return (
    await Promise.all(panelUserIds.map((id) => interaction.guild.members.fetch(id).catch(() => null)))
  ).filter(Boolean);
}

/**
 * Nome do canal a mostrar no título do painel: o da sessão ativa, se
 * houver, senão o canal em que o primeiro membro listado estiver agora
 * (aproximação só para exibição — nunca afeta o que os botões fazem).
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {import('discord.js').GuildMember[]} members
 * @returns {string | undefined}
 */
function resolvePanelChannelName(interaction, members) {
  const activeSession = sessionManager.get(interaction.guildId);
  if (activeSession.voiceChannelId) {
    return interaction.guild.channels.cache.get(activeSession.voiceChannelId)?.name;
  }
  return members[0]?.voice?.channel?.name;
}

/**
 * Reconstrói o embed + os componentes do painel a partir do estado atual.
 * @param {import('discord.js').ButtonInteraction} interaction
 * @returns {Promise<{ embed: import('discord.js').EmbedBuilder, components: import('discord.js').ActionRowBuilder[] }>}
 */
async function rebuildPanel(interaction) {
  const members = await getPanelMembers(interaction);
  const sessionState = sessionManager.get(interaction.guildId).state;
  const channelName = resolvePanelChannelName(interaction, members);
  return {
    embed: buildPanelEmbed({ channelName, sessionState }),
    components: buildCallPanelComponents({ sessionState, members }),
  };
}

/**
 * Anuncia publicamente (não efêmero) uma mudança de estado da gravação
 * feita via painel — quem está na call precisa saber, mesmo que só o
 * admin veja o painel em si.
 * @param {import('discord.js').ButtonInteraction} interaction
 * @param {string | { content: string, files?: import('discord.js').AttachmentBuilder[] }} payload
 */
async function announcePublicly(interaction, payload) {
  const body = typeof payload === 'string' ? { content: payload } : payload;
  await interaction.followUp({ ...body, ephemeral: false }).catch((err) =>
    logger.error({ err: err.message, guildId: interaction.guildId }, 'Falha ao anunciar publicamente via painel'),
  );
}

/**
 * Alterna o mute de um usuário clicado no painel `/c-call-panel`. Fica
 * só no painel (efêmero) — diferente de start/pause/finish/cancel, um
 * toggle de mute não gera aviso público (evita spam se o admin mutar
 * várias pessoas em sequência).
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handleMuteToggle(interaction) {
  const userId = interaction.customId.slice(MUTE_TOGGLE_PREFIX.length + 1);
  const guildLogger = logger.child({ guildId: interaction.guildId });

  const member = await interaction.guild.members.fetch(userId).catch(() => null);
  if (!member) {
    await interaction.reply({ content: c('Não encontrei mais esse usuário.'), ephemeral: true });
    return;
  }
  if (isMuteExempt(member)) {
    await interaction.reply({ content: c('Não silencio administradores.'), ephemeral: true });
    return;
  }
  if (!member.voice.channelId) {
    await interaction.reply({ content: c('Esse usuário não está mais em um canal de voz.'), ephemeral: true });
    return;
  }

  try {
    await member.voice.setMute(!member.voice.serverMute, 'Alternado via painel /c-call-panel');
  } catch (err) {
    guildLogger.error({ err: err.message, userId }, 'Falha ao alternar mute via painel');
    await interaction.reply({ content: c('Não consegui alternar o mute desse usuário.'), ephemeral: true });
    return;
  }

  const panel = await rebuildPanel(interaction);
  await interaction.update({ embeds: [panel.embed], components: panel.components });
}

/**
 * Botão "Iniciar/Retomar" do painel.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handlePanelStart(interaction) {
  const guildId = interaction.guildId;
  const connection = getVoiceConnection(guildId);
  if (!connection) {
    await interaction.reply({
      content: `${c('O bot precisa estar conectado a um canal de voz. Use')} \`/c-join\` ${c('primeiro.')}`,
      ephemeral: true,
    });
    return;
  }

  const result = startOrResumeSession(guildId, {
    sessionManager,
    recorderRegistry,
    nicknameStore,
    env,
    logger: logger.child({ guildId }),
    connection,
    guild: interaction.guild,
    textChannelId: interaction.channelId,
    startedBy: interaction.user.id,
  });

  if (!result.ok) {
    await interaction.reply({ content: c('Já existe uma gravação em andamento neste servidor.'), ephemeral: true });
    return;
  }

  const panel = await rebuildPanel(interaction);
  await interaction.update({ embeds: [panel.embed], components: panel.components });

  const channel = interaction.guild.channels.cache.get(connection.joinConfig.channelId);
  const publicMessage =
    result.action === 'resumed'
      ? c('▶️ Gravação retomada.')
      : `${c('🔴 Gravando esta call em')} **${channel?.name ?? connection.joinConfig.channelId}**. ${c('Avisem quem ainda não sabia que a conversa está sendo registrada.')}`;
  await announcePublicly(interaction, publicMessage);
}

/**
 * Botão "Pausar" do painel.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handlePanelPause(interaction) {
  const result = pauseSession(interaction.guildId, { sessionManager, recorderRegistry });
  if (!result.ok) {
    await interaction.reply({ content: c('Não há gravação em andamento para pausar.'), ephemeral: true });
    return;
  }

  const panel = await rebuildPanel(interaction);
  await interaction.update({ embeds: [panel.embed], components: panel.components });
  await announcePublicly(interaction, c('⏸️ Gravação pausada. Novas falas não serão capturadas até retomar.'));
}

/**
 * Botão "Cancelar" do painel: descarta a sessão e os áudios, sem
 * transcrever.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handlePanelCancel(interaction) {
  const guildId = interaction.guildId;
  const result = await cancelSession(guildId, { sessionManager, recorderRegistry, env, logger: logger.child({ guildId }) });
  if (!result.ok) {
    await interaction.reply({ content: c('Não há gravação ativa para cancelar.'), ephemeral: true });
    return;
  }

  const panel = await rebuildPanel(interaction);
  await interaction.update({ embeds: [panel.embed], components: panel.components });
  await announcePublicly(interaction, `🗑️ ${c('Gravação cancelada e áudios apagados.')}`);
}

/**
 * Botão "Finalizar" do painel. Transcrever pode demorar minutos (rate
 * limit da Groq), então: confirma a interação primeiro (`deferUpdate`),
 * mostra de imediato um estado "transcrevendo..." (senão o painel fica
 * com cara de travado), e só então processa e edita com o resultado
 * final — sucesso, vazio ou erro, sempre com aviso público também.
 * @param {import('discord.js').ButtonInteraction} interaction
 */
async function handlePanelFinish(interaction) {
  const guildId = interaction.guildId;
  await interaction.deferUpdate();

  const membersBeforeFinish = await getPanelMembers(interaction);
  const channelName = resolvePanelChannelName(interaction, membersBeforeFinish);
  await interaction.editReply({
    embeds: [buildPanelEmbed({ channelName, sessionState: 'finishing' })],
    components: [buildRecordingControlsRow('finishing'), ...buildMuteButtonRows(membersBeforeFinish)],
  });

  const guildLogger = logger.child({ guildId });
  const result = await finishSession(guildId, { sessionManager, recorderRegistry, env, logger: guildLogger });
  const panel = await rebuildPanel(interaction);
  await interaction.editReply({ embeds: [panel.embed], components: panel.components });

  if (!result.ok) {
    const message =
      result.code === 'not-recording'
        ? c('Não há gravação ativa para finalizar.')
        : `⚠️ ${c('Houve um erro ao transcrever. Os áudios foram mantidos para uma nova tentativa.')}`;
    await announcePublicly(interaction, message);
    return;
  }

  if (result.emptyMessage) {
    await announcePublicly(interaction, c('Gravação encerrada, mas nenhuma fala foi capturada — nada para transcrever.'));
    return;
  }

  const files = result.parts.map(
    (part, index) =>
      new AttachmentBuilder(Buffer.from(part, 'utf8'), {
        name: result.parts.length > 1 ? `transcricao-parte-${index + 1}.md` : 'transcricao.md',
      }),
  );
  await announcePublicly(interaction, { content: `✅ ${c('Gravação finalizada. Transcrição em anexo.')}`, files });
}

const PANEL_BUTTON_HANDLERS = {
  [RECORDING_START_ID]: handlePanelStart,
  [RECORDING_PAUSE_ID]: handlePanelPause,
  [RECORDING_FINISH_ID]: handlePanelFinish,
  [RECORDING_CANCEL_ID]: handlePanelCancel,
};

client.on('interactionCreate', async (interaction) => {
  if (interaction.isButton()) {
    const handler = interaction.customId.startsWith(`${MUTE_TOGGLE_PREFIX}:`)
      ? handleMuteToggle
      : PANEL_BUTTON_HANDLERS[interaction.customId];
    if (!handler) return;

    try {
      await handler(interaction);
    } catch (err) {
      logger.error({ err: err.message, guildId: interaction.guildId }, 'Erro não tratado no painel');
    }
    return;
  }

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
