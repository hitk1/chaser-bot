export type MessageRole = 'user' | 'assistant' | 'tool' | 'system';

export interface Message {
  id?: string;
  sessionId: string;
  role: MessageRole;
  content: string;
  toolName?: string;
  discordMessageId?: string;
  createdAt: Date;
}
