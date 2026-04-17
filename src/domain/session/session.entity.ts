import { Message, MessageRole } from './message.entity';

export interface SessionProps {
  id: string;
  userId: string;
  channelId: string;
  title: string | null;
  createdAt: Date;
  lastActiveAt: Date;
  messages: Message[];
}

export class Session {
  readonly id: string;
  readonly userId: string;
  readonly channelId: string;
  title: string | null;
  readonly createdAt: Date;
  lastActiveAt: Date;
  readonly messages: Message[];

  constructor(props: SessionProps) {
    this.id = props.id;
    this.userId = props.userId;
    this.channelId = props.channelId;
    this.title = props.title;
    this.createdAt = props.createdAt;
    this.lastActiveAt = props.lastActiveAt;
    this.messages = props.messages;
  }

  isActive(inactivityMinutes: number): boolean {
    const elapsed = Date.now() - this.lastActiveAt.getTime();
    return elapsed < inactivityMinutes * 60 * 1000;
  }

  addMessage(role: MessageRole, content: string, toolName?: string): Message {
    const message: Message = {
      sessionId: this.id,
      role,
      content,
      toolName,
      createdAt: new Date(),
    };

    this.messages.push(message);
    this.lastActiveAt = new Date();

    if (!this.title && role === 'user') {
      this.title = content.trim().slice(0, 40);
    }

    return message;
  }

  toPromptMessages(): Array<{ role: MessageRole; content: string }> {
    return this.messages.map((m) => ({ role: m.role, content: m.content }));
  }
}
