import { PrismaClient } from '@prisma/client';
import { Message, MessageRole } from '../../domain/session/message.entity';
import { Session } from '../../domain/session/session.entity';
import { ISessionRepository } from '../../domain/session/session.repository';

type PrismaMessage = {
  id: string;
  sessionId: string;
  role: string;
  content: string;
  toolName: string | null;
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
    const sessionRow = await this.prisma.session.findUnique({ where: { id }, include: includeMessages });
    return sessionRow ? toSession(sessionRow) : null;
  }

  async findLatestByUserAndChannel(userId: string, channelId: string): Promise<Session | null> {
    const sessionRow = await this.prisma.session.findFirst({
      where: { userId, channelId },
      orderBy: { lastActiveAt: 'desc' },
      include: includeMessages,
    });
    return sessionRow ? toSession(sessionRow) : null;
  }

  async findAllByUser(userId: string): Promise<Session[]> {
    const sessionRows = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
      include: includeMessages,
    });
    return sessionRows.map(toSession);
  }

  async create(userId: string, channelId: string): Promise<Session> {
    const createdSession = await this.prisma.session.create({
      data: { userId, channelId },
      include: includeMessages,
    });
    return toSession(createdSession);
  }

  async update(session: Session): Promise<void> {
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
  ): Promise<Message> {
    const createdMessage = await this.prisma.message.create({
      data: { sessionId, role, content, toolName: toolName ?? null },
    });
    return toMessage(createdMessage);
  }

  async switchToChannel(sessionId: string, channelId: string): Promise<Session> {
    const updatedSession = await this.prisma.session.update({
      where: { id: sessionId },
      data: { channelId, lastActiveAt: new Date() },
      include: includeMessages,
    });
    return toSession(updatedSession);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.session.delete({ where: { id } });
  }
}
