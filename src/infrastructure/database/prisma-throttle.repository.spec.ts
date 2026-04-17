import { clearDatabase } from '../../test/db-helpers';
import { prisma } from '../../test/prisma';
import { PrismaUserRepository } from './prisma-user.repository';
import { PrismaThrottleRepository } from './prisma-throttle.repository';

const userRepo = new PrismaUserRepository(prisma);
const throttleRepo = new PrismaThrottleRepository(prisma);

describe('PrismaThrottleRepository', () => {
  let userId: string;

  beforeEach(async () => {
    await clearDatabase();
    const user = await userRepo.findOrCreate('discord-throttle-user');
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('findByUserId', () => {
    it('returns null when no entry exists', async () => {
      const result = await throttleRepo.findByUserId(userId);
      expect(result).toBeNull();
    });

    it('parses requestTimestamps from JSON', async () => {
      const timestamps = [Date.now() - 1000, Date.now() - 2000];
      await throttleRepo.upsert({ id: '', userId, requestTimestamps: timestamps, updatedAt: new Date() });
      const entry = await throttleRepo.findByUserId(userId);
      expect(entry!.requestTimestamps).toEqual(timestamps);
    });
  });

  describe('upsert', () => {
    it('creates a new entry when none exists', async () => {
      const timestamps = [Date.now()];
      await throttleRepo.upsert({ id: '', userId, requestTimestamps: timestamps, updatedAt: new Date() });
      const entry = await throttleRepo.findByUserId(userId);
      expect(entry).not.toBeNull();
      expect(entry!.userId).toBe(userId);
    });

    it('updates timestamps on an existing entry', async () => {
      const initial = [Date.now() - 5000];
      await throttleRepo.upsert({ id: '', userId, requestTimestamps: initial, updatedAt: new Date() });

      const updated = [Date.now() - 5000, Date.now()];
      await throttleRepo.upsert({ id: '', userId, requestTimestamps: updated, updatedAt: new Date() });

      const entry = await throttleRepo.findByUserId(userId);
      expect(entry!.requestTimestamps).toHaveLength(2);
    });
  });
});
