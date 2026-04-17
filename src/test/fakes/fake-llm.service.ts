import { ILlmService, LlmMessage } from '../../application/ports/llm.port';

export class FakeLlmService implements ILlmService {
  private readonly queue: string[] = [];

  queueResponse(response: string): this {
    this.queue.push(response);
    return this;
  }

  async chat(messages: LlmMessage[]): Promise<string> {
    if (this.queue.length > 0) {
      return this.queue.shift()!;
    }
    const last = messages[messages.length - 1];
    return `Echo: ${last?.content ?? ''}`;
  }
}
