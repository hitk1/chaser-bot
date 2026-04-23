import { PrismaClient } from '@prisma/client';
import { Message, MessageRole } from '../../domain/session/message.entity';
import { Session } from '../../domain/session/session.entity';
import { ISessionRepository } from '../../domain/session/session.repository';
import { createLogger } from '../../bootstrap/logger';

const logger = createLogger('session-repository');

type PrismaMessage = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  toolName: string | null;
  discordMessageId: string | null;
  createdAt: Date;
};

type PrismaSessionWithMessages = {
  id: string;
  userId: string;
  channelId: string;
  title: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  messages: PrismaMessage[];
};

function toMessage(prismaMessage: PrismaMessage): Message {
  return {
    id: prismaMessage.id,
    sessionId: prismaMessage.sessionId,
    role: prismaMessage.role as MessageRole,
    content: prismaMessage.content,
    toolName: prismaMessage.toolName ?? undefined,
    discordMessageId: prismaMessage.discordMessageId ?? undefined,
    createdAt: prismaMessage.createdAt,
  };
}

function toSession(prismaSession: PrismaSessionWithMessages): Session {
  return new Session({
    id: prismaSession.id,
    userId: prismaSession.userId,
    channelId: prismaSession.channelId,
    title: prismaSession.title,
    createdAt: prismaSession.createdAt,
    lastActiveAt: prismaSession.lastActiveAt,
    messages: prismaSession.messages.map(toMessage),
  });
}

const includeMessages = { messages: { orderBy: { createdAt: 'asc' as const } } };

export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Session | null> {
    logger.info({ id }, '[SESSION][REPOSITORY] findById');
    const sessionRow = await this.prisma.session.findUnique({ where: { id }, include: includeMessages });
    logger.info({ id, found: !!sessionRow }, '[SESSION][REPOSITORY] findById result');
    return sessionRow ? toSession(sessionRow) : null;
  }

  async findLatestByUserAndChannel(userId: string, channelId: string): Promise<Session | null> {
    logger.info({ userId, channelId }, '[SESSION][REPOSITORY] findLatestByUserAndChannel');
    const sessionRow = await this.prisma.session.findFirst({
      where: { userId, channelId },
      orderBy: { lastActiveAt: 'desc' },
      include: includeMessages,
    });
    logger.info(
      { userId, channelId, found: !!sessionRow, sessionId: sessionRow?.id },
      '[SESSION][REPOSITORY] findLatestByUserAndChannel result',
    );
    return sessionRow ? toSession(sessionRow) : null;
  }

  async findByDiscordMessageId(discordMessageId: string): Promise<Session | null> {
    logger.info({ discordMessageId }, '[SESSION][REPOSITORY] findByDiscordMessageId');
    const messageRow = await this.prisma.message.findUnique({
      where: { discordMessageId },
      include: { session: { include: includeMessages } },
    });
    logger.info(
      { discordMessageId, found: !!messageRow, sessionId: messageRow?.sessionId },
      '[SESSION][REPOSITORY] findByDiscordMessageId result',
    );
    return messageRow ? toSession(messageRow.session) : null;
  }

  async findAllByUser(userId: string): Promise<Session[]> {
    logger.info({ userId }, '[SESSION][REPOSITORY] findAllByUser');
    const sessionRows = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
      include: includeMessages,
    });
    logger.info({ userId, count: sessionRows.length }, '[SESSION][REPOSITORY] findAllByUser result');
    return sessionRows.map(toSession);
  }

  async create(userId: string, channelId: string): Promise<Session> {
    logger.info({ userId, channelId }, '[SESSION][REPOSITORY] create');
    const createdSession = await this.prisma.session.create({
      data: { userId, channelId },
      include: includeMessages,
    });
    logger.info({ userId, channelId, sessionId: createdSession.id }, '[SESSION][REPOSITORY] create result');
    return toSession(createdSession);
  }

  async update(session: Session): Promise<void> {
    logger.info({ sessionId: session.id }, '[SESSION][REPOSITORY] update');
    await this.prisma.session.update({
      where: { id: session.id },
      data: { title: session.title, lastActiveAt: session.lastActiveAt },
    });
  }

  async appendMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
    toolName?: string,
    discordMessageId?: string,
  ): Promise<Message> {
    logger.info({ sessionId, role }, '[SESSION][REPOSITORY] appendMessage');
    const createdMessage = await this.prisma.message.create({
      data: { sessionId, role, content, toolName: toolName ?? null, discordMessageId: discordMessageId ?? null },
    });
    return toMessage(createdMessage);
  }

  async linkDiscordMessageToSession(sessionId: string, discordMessageId: string): Promise<void> {
    logger.info({ sessionId, discordMessageId }, '[SESSION][REPOSITORY] linkDiscordMessageToSession');
    const latestAssistant = await this.prisma.message.findFirst({
      where: { sessionId, role: 'assistant', discordMessageId: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!latestAssistant) {
      logger.warn({ sessionId }, '[SESSION][REPOSITORY] linkDiscordMessageToSession: no unlinked assistant message found');
      return;
    }
    await this.prisma.message.update({
      where: { id: latestAssistant.id },
      data: { discordMessageId },
    });
    logger.info({ sessionId, messageId: latestAssistant.id, discordMessageId }, '[SESSION][REPOSITORY] linkDiscordMessageToSession result');
  }

  async switchToChannel(sessionId: string, channelId: string): Promise<Session> {
    logger.info({ sessionId, channelId }, '[SESSION][REPOSITORY] switchToChannel');
    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: { channelId, lastActiveAt: new Date() },
      include: includeMessages,
    });
    return toSession(updatedSession);
  }

  async delete(id: string): Promise<void> {
    logger.info({ id }, '[SESSION][REPOSITORY] delete');
    await this.prisma.session.delete({ where: { id } });
  }
}
