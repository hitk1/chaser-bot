import { IWebSearchService } from '../../../application/ports/web-search.port';
import { LlmFunction } from '../function-registry';

interface WebSearchArgs {
  query: string;
}

export function createWebSearchFunction(searchService: IWebSearchService): LlmFunction {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'web_search',
        description:
          'Search the web for up-to-date information about GrandChase game mechanics, characters, equipment, or strategies.',
        parameters: {
          type: 'object',
          properties: {
            query: {
              type: 'string',
              description: 'The search query to look up',
            },
          },
          required: ['query'],
        },
      },
    },

    async execute(args: unknown): Promise<string> {
      const { query } = args as WebSearchArgs;
      const results = await searchService.search(query);

      if (results.length === 0) {
        return 'No results found for the given query.';
      }

      return results
        .map((result) => `**${result.title}**\n${result.snippet}\n${result.url}`)
        .join('\n\n');
    },
  };
}
