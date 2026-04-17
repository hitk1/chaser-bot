import { PrismaClient } from '@prisma/client';
import { createLogger } from './logger';

const log = createLogger('prisma');

export const prisma = new PrismaClient();

process.on('SIGINT', async () => {
  await prisma.$disconnect();
  log.info('Prisma disconnected on SIGINT');
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await prisma.$disconnect();
  log.info('Prisma disconnected on SIGTERM');
  process.exit(0);
});
