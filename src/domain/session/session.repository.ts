import { Message, MessageRole } from './message.entity';
import { Session } from './session.entity';

export interface ISessionRepository {
  findById(id: string): Promise<Session | null>;
  findLatestByUserAndChannel(userId: string, channelId: string): Promise<Session | null>;
  findAllByUser(userId: string): Promise<Session[]>;
  findByDiscordMessageId(discordMessageId: string): Promise<Session | null>;
  create(userId: string, channelId: string): Promise<Session>;
  update(session: Session): Promise<void>;
  appendMessage(
    sessionId: string,
    role: MessageRole,
    content: string,
    toolName?: string,
    discordMessageId?: string,
  ): Promise<Message>;
  linkDiscordMessageToSession(sessionId: string, discordMessageId: string): Promise<void>;
  switchToChannel(sessionId: string, channelId: string): Promise<Session>;
  delete(id: string): Promise<void>;
}
