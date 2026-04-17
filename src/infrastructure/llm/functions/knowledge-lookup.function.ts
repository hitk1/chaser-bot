import { IKnowledgeRepository } from '../../../domain/knowledge/knowledge.repository';
import { LlmFunction } from '../function-registry';

interface KnowledgeLookupArgs {
  keywords: string[];
}

export function createKnowledgeLookupFunction(knowledgeRepository: IKnowledgeRepository): LlmFunction {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'knowledge_lookup',
        description:
          'Look up curated GrandChase knowledge stored by the server members. Use this before web search for game-specific tips, builds, and strategies.',
        parameters: {
          type: 'object',
          properties: {
            keywords: {
              type: 'array',
              items: { type: 'string' },
              description: 'Keywords or tags to search for (e.g. ["mage", "equipment", "card"])',
            },
          },
          required: ['keywords'],
        },
      },
    },

    async execute(args: unknown): Promise<string> {
      const { keywords } = args as KnowledgeLookupArgs;
      const entries = await knowledgeRepository.searchByTags(keywords);

      if (entries.length === 0) {
        return 'No curated knowledge found for the given keywords.';
      }

      return entries.map((entry) => entry.sanitizedContent).join('\n---\n');
    },
  };
}
