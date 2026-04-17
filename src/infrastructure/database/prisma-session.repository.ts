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

function toMessage(m: PrismaMessage): Message {
  return {
    id: m.id,
    sessionId: m.sessionId,
    role: m.role as MessageRole,
    content: m.content,
    toolName: m.toolName ?? undefined,
    createdAt: m.createdAt,
  };
}

function toSession(s: PrismaSessionWithMessages): Session {
  return new Session({
    id: s.id,
    userId: s.userId,
    channelId: s.channelId,
    title: s.title,
    createdAt: s.createdAt,
    lastActiveAt: s.lastActiveAt,
    messages: s.messages.map(toMessage),
  });
}

const includeMessages = { messages: { orderBy: { createdAt: 'asc' as const } } };

export class PrismaSessionRepository implements ISessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Session | null> {
    const s = await this.prisma.session.findUnique({ where: { id }, include: includeMessages });
    return s ? toSession(s) : null;
  }

  async findLatestByUserAndChannel(userId: string, channelId: string): Promise<Session | null> {
    const s = await this.prisma.session.findFirst({
      where: { userId, channelId },
      orderBy: { lastActiveAt: 'desc' },
      include: includeMessages,
    });
    return s ? toSession(s) : null;
  }

  async findAllByUser(userId: string): Promise<Session[]> {
    const rows = await this.prisma.session.findMany({
      where: { userId },
      orderBy: { lastActiveAt: 'desc' },
      include: includeMessages,
    });
    return rows.map(toSession);
  }

  async create(userId: string, channelId: string): Promise<Session> {
    const s = await this.prisma.session.create({
      data: { userId, channelId },
      include: includeMessages,
    });
    return toSession(s);
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
    const m = await this.prisma.message.create({
      data: { sessionId, role, content, toolName: toolName ?? null },
    });
    return toMessage(m);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.session.delete({ where: { id } });
  }
}
