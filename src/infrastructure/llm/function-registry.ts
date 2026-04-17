import OpenAI from 'openai';

export interface LlmFunction {
  definition: OpenAI.Chat.ChatCompletionTool;
  execute(args: unknown): Promise<string>;
}

export class FunctionRegistry {
  private readonly functions = new Map<string, LlmFunction>();

  register(name: string, llmFunction: LlmFunction): this {
    this.functions.set(name, llmFunction);
    return this;
  }

  getDefinitions(): OpenAI.Chat.ChatCompletionTool[] {
    return Array.from(this.functions.values()).map((llmFunction) => llmFunction.definition);
  }

  async execute(name: string, args: unknown): Promise<string> {
    const llmFunction = this.functions.get(name);
    if (!llmFunction) {
      return `Unknown function: ${name}`;
    }
    return llmFunction.execute(args);
  }
}
