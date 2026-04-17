import { PrismaClient } from '@prisma/client';
import path from 'path';

const TEST_DB_PATH = path.resolve('./prisma/test.db');

export const prisma = new PrismaClient({
  datasources: { db: { url: `file:${TEST_DB_PATH}` } },
});
