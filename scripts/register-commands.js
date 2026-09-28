#!/usr/bin/env node
/**
 * Registra os slash commands manualmente. Útil pra forçar o registro sem
 * esperar o bot logar (o bot já faz isso automaticamente no boot — ver
 * `src/index.js`), ou pra rodar em CI/scripts de deploy separados.
 */
import { loadEnv } from '../src/config/env.js';
import { createLogger } from '../src/utils/logger.js';
import { registerCommands } from '../src/register-commands.js';

const env = loadEnv();
const logger = createLogger({ level: env.LOG_LEVEL });

try {
  await registerCommands(env, logger);
} catch (err) {
  logger.error({ err: err.message }, 'Falha ao registrar comandos');
  process.exit(1);
}
