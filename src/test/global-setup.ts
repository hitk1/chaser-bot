import { execSync } from 'child_process';
import path from 'path';

const TEST_DB_PATH = path.resolve('./prisma/test.db');

export default async function globalSetup() {
  execSync('npx prisma migrate deploy', {
    env: { ...process.env, DATABASE_URL: `file:${TEST_DB_PATH}` },
    stdio: 'inherit',
  });
}
