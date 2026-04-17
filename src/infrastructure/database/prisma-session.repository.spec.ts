import { clearDatabase } from '../../test/db-helpers';
import { prisma } from '../../test/prisma';
import { PrismaUserRepository } from './prisma-user.repository';
import { PrismaSessionRepository } from './prisma-session.repository';

const userRepo = new PrismaUserRepository(prisma);
const sessionRepo = new PrismaSessionRepository(prisma);

describe('PrismaSessionRepository', () => {
  let userId: string;

  beforeEach(async () => {
    await clearDatabase();
    const user = await userRepo.findOrCreate('discord-session-user');
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('create', () => {
    it('creates a session with empty messages', async () => {
      const session = await sessionRepo.create(userId, 'channel-1');
      expect(session.id).toBeDefined();
      expect(session.userId).toBe(userId);
      expect(session.channelId).toBe('channel-1');
      expect(session.messages).toHaveLength(0);
      expect(session.title).toBeNull();
    });
  });

  describe('findById', () => {
    it('returns null for a non-existent id', async () => {
      const result = await sessionRepo.findById('ghost-id');
      expect(result).toBeNull();
    });

    it('returns the session with its messages', async () => {
      const created = await sessionRepo.create(userId, 'channel-1');
      await sessionRepo.appendMessage(created.id, 'user', 'hello');
      const found = await sessionRepo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.messages).toHaveLength(1);
      expect(found!.messages[0].role).toBe('user');
      expect(found!.messages[0].content).toBe('hello');
    });
  });

  describe('findLatestByUserAndChannel', () => {
    it('returns null when no session exists for that user/channel', async () => {
      const result = await sessionRepo.findLatestByUserAndChannel(userId, 'channel-99');
      expect(result).toBeNull();
    });

    it('returns the most recently active session', async () => {
      const old = await sessionRepo.create(userId, 'channel-1');
      await prisma.session.update({
        where: { id: old.id },
        data: { lastActiveAt: new Date(Date.now() - 60000) },
      });
      const recent = await sessionRepo.create(userId, 'channel-1');

      const result = await sessionRepo.findLatestByUserAndChannel(userId, 'channel-1');
      expect(result!.id).toBe(recent.id);
    });
  });

  describe('findAllByUser', () => {
    it('returns empty array when user has no sessions', async () => {
      const other = await userRepo.findOrCreate('discord-other');
      const result = await sessionRepo.findAllByUser(other.id);
      expect(result).toHaveLength(0);
    });

    it('returns all sessions for the user ordered by lastActiveAt desc', async () => {
      await sessionRepo.create(userId, 'channel-1');
      await sessionRepo.create(userId, 'channel-2');
      const result = await sessionRepo.findAllByUser(userId);
      expect(result).toHaveLength(2);
    });
  });

  describe('update', () => {
    it('persists title and lastActiveAt changes', async () => {
      const session = await sessionRepo.create(userId, 'channel-1');
      session.addMessage('user', 'pergunta sobre mago');
      await sessionRepo.update(session);

      const found = await sessionRepo.findById(session.id);
      expect(found!.title).toBe('pergunta sobre mago');
    });
  });

  describe('appendMessage', () => {
    it('creates a message linked to the session', async () => {
      const session = await sessionRepo.create(userId, 'channel-1');
      const msg = await sessionRepo.appendMessage(session.id, 'user', 'oi', undefined);
      expect(msg.id).toBeDefined();
      expect(msg.sessionId).toBe(session.id);
      expect(msg.role).toBe('user');
      expect(msg.content).toBe('oi');
    });

    it('stores toolName when provided', async () => {
      const session = await sessionRepo.create(userId, 'channel-1');
      const msg = await sessionRepo.appendMessage(session.id, 'tool', 'resultado', 'web_search');
      expect(msg.toolName).toBe('web_search');
    });

    it('messages are returned in creation order', async () => {
      const session = await sessionRepo.create(userId, 'channel-1');
      await sessionRepo.appendMessage(session.id, 'user', 'primeiro');
      await sessionRepo.appendMessage(session.id, 'assistant', 'segundo');
      const found = await sessionRepo.findById(session.id);
      expect(found!.messages[0].role).toBe('user');
      expect(found!.messages[1].role).toBe('assistant');
    });
  });

  describe('delete', () => {
    it('removes the session', async () => {
      const session = await sessionRepo.create(userId, 'channel-1');
      await sessionRepo.delete(session.id);
      const found = await sessionRepo.findById(session.id);
      expect(found).toBeNull();
    });

    it('cascades to messages', async () => {
      const session = await sessionRepo.create(userId, 'channel-1');
      await sessionRepo.appendMessage(session.id, 'user', 'msg');
      await sessionRepo.delete(session.id);
      const messages = await prisma.message.findMany({ where: { sessionId: session.id } });
      expect(messages).toHaveLength(0);
    });
  });
});
