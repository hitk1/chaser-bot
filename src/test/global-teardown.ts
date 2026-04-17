import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const TEST_DB_PATH = path.resolve('./prisma/test.db');

export default async function globalTeardown() {
  const prisma = new PrismaClient({
    datasources: { db: { url: `file:${TEST_DB_PATH}` } },
  });
  await prisma.$disconnect();

  for (const suffix of ['', '-shm', '-wal']) {
    try {
      fs.unlinkSync(`${TEST_DB_PATH}${suffix}`);
    } catch {
      // file may not exist
    }
  }
}
