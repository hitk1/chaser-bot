import { config } from './bootstrap/env';
import { createLogger } from './bootstrap/logger';
import { prisma } from './bootstrap/prisma-client';

const logger = createLogger('main');

async function bootstrap() {
  logger.info({ nodeEnv: config.NODE_ENV, logLevel: config.LOG_LEVEL }, 'Starting chaser-bot');

  try {
    await prisma.$connect();
    logger.info('Database connected');

    logger.info('chaser-bot ready — waiting for Discord connection');
  } catch (error) {
    logger.error({ error }, 'Failed to start application');
    process.exit(1);
  }
}

bootstrap();
