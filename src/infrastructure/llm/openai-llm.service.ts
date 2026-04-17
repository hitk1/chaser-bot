import OpenAI from 'openai';
import { ILlmService, LlmMessage } from '../../application/ports/llm.port';
import { FunctionRegistry } from './function-registry';

export class OpenAiLlmService implements ILlmService {
  private static readonly MAX_TOOL_ITERATIONS = 3;

  constructor(
    private readonly openai: OpenAI,
    private readonly registry: FunctionRegistry,
    private readonly model: string,
    private readonly maxTokens: number,
  ) {}

  async chat(messages: LlmMessage[]): Promise<string> {
    const openAiMessages: OpenAI.Chat.ChatCompletionMessageParam[] = messages
      .filter((message) => message.role !== 'tool')
      .map((message) => ({
        role: message.role as 'user' | 'assistant' | 'system',
        content: message.content,
      }));

    const toolDefinitions = this.registry.getDefinitions();
    const toolOptions =
      toolDefinitions.length > 0
        ? { tools: toolDefinitions, tool_choice: 'auto' as const }
        : {};

    const currentMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [...openAiMessages];

    for (let iteration = 0; iteration < OpenAiLlmService.MAX_TOOL_ITERATIONS; iteration++) {
      const response = await this.openai.chat.completions.create({
        model: this.model,
        max_tokens: this.maxTokens,
        messages: currentMessages,
        ...toolOptions,
      });

      const choice = response.choices[0];

      if (choice.finish_reason !== 'tool_calls' || !choice.message.tool_calls) {
        return choice.message.content ?? '';
      }

      currentMessages.push(choice.message);

      for (const toolCall of choice.message.tool_calls) {
        const toolResult = await this.registry.execute(
          toolCall.function.name,
          JSON.parse(toolCall.function.arguments),
        );

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: toolResult,
        });
      }
    }

    // Max iterations reached — ask for a final answer without tools
    const finalResponse = await this.openai.chat.completions.create({
      model: this.model,
      max_tokens: this.maxTokens,
      messages: currentMessages,
    });

    return finalResponse.choices[0].message.content ?? '';
  }
}
