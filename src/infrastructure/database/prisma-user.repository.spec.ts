import { clearDatabase } from '../../test/db-helpers';
import { prisma } from '../../test/prisma';
import { PrismaUserRepository } from './prisma-user.repository';

const repo = new PrismaUserRepository(prisma);

describe('PrismaUserRepository', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('findOrCreate', () => {
    it('creates a new user when none exists', async () => {
      const user = await repo.findOrCreate('discord-123');
      expect(user.id).toBeDefined();
      expect(user.discordUserId).toBe('discord-123');
      expect(user.createdAt).toBeInstanceOf(Date);
    });

    it('returns the existing user on subsequent calls', async () => {
      const first = await repo.findOrCreate('discord-abc');
      const second = await repo.findOrCreate('discord-abc');
      expect(second.id).toBe(first.id);
    });

    it('creates distinct users for different discordUserIds', async () => {
      const a = await repo.findOrCreate('discord-A');
      const b = await repo.findOrCreate('discord-B');
      expect(a.id).not.toBe(b.id);
    });
  });

  describe('findByDiscordId', () => {
    it('returns null when user does not exist', async () => {
      const result = await repo.findByDiscordId('ghost-user');
      expect(result).toBeNull();
    });

    it('returns the user when it exists', async () => {
      await repo.findOrCreate('discord-xyz');
      const found = await repo.findByDiscordId('discord-xyz');
      expect(found).not.toBeNull();
      expect(found!.discordUserId).toBe('discord-xyz');
    });
  });
});
