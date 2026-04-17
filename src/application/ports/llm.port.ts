import { MessageRole } from '../../domain/session/message.entity';

export interface LlmMessage {
  role: MessageRole;
  content: string;
  toolName?: string;
}

export interface ILlmService {
  chat(messages: LlmMessage[]): Promise<string>;
}
