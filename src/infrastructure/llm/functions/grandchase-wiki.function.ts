import { LlmFunction } from '../function-registry';

interface WikiArgs {
  topic: string;
}

interface MediaWikiSearchResult {
  title: string;
}

interface MediaWikiPage {
  extract?: string;
}

interface MediaWikiQueryResponse {
  query?: {
    search?: MediaWikiSearchResult[];
    pages?: Record<string, MediaWikiPage>;
  };
}

const WIKI_API_BASE = 'https://grandchase.fandom.com/api.php';

async function searchWikiPage(topic: string): Promise<string | null> {
  const searchUrl = new URL(WIKI_API_BASE);
  searchUrl.searchParams.set('action', 'query');
  searchUrl.searchParams.set('list', 'search');
  searchUrl.searchParams.set('srsearch', topic);
  searchUrl.searchParams.set('srlimit', '1');
  searchUrl.searchParams.set('format', 'json');
  searchUrl.searchParams.set('origin', '*');

  const searchResponse = await fetch(searchUrl.toString());
  const searchData = (await searchResponse.json()) as MediaWikiQueryResponse;
  const searchResults = searchData.query?.search ?? [];

  if (searchResults.length === 0) {
    return null;
  }

  return searchResults[0].title;
}

async function fetchPageExtract(pageTitle: string): Promise<string> {
  const extractUrl = new URL(WIKI_API_BASE);
  extractUrl.searchParams.set('action', 'query');
  extractUrl.searchParams.set('titles', pageTitle);
  extractUrl.searchParams.set('prop', 'extracts');
  extractUrl.searchParams.set('exsentences', '5');
  extractUrl.searchParams.set('explaintext', '1');
  extractUrl.searchParams.set('format', 'json');
  extractUrl.searchParams.set('origin', '*');

  const extractResponse = await fetch(extractUrl.toString());
  const extractData = (await extractResponse.json()) as MediaWikiQueryResponse;
  const pages = extractData.query?.pages ?? {};
  const page = Object.values(pages)[0];

  return page?.extract ?? 'No content found for this page.';
}

export function createGrandChaseWikiFunction(): LlmFunction {
  return {
    definition: {
      type: 'function',
      function: {
        name: 'grandchase_wiki',
        description:
          'Fetch structured information from the GrandChase fandom wiki about characters, classes, skills, dungeons, or game mechanics.',
        parameters: {
          type: 'object',
          properties: {
            topic: {
              type: 'string',
              description: 'The topic to look up on the GrandChase wiki (e.g. "Elesis", "Kounat\'s Collapse")',
            },
          },
          required: ['topic'],
        },
      },
    },

    async execute(args: unknown): Promise<string> {
      const { topic } = args as WikiArgs;

      const pageTitle = await searchWikiPage(topic);
      if (!pageTitle) {
        return `No wiki page found for "${topic}".`;
      }

      const extract = await fetchPageExtract(pageTitle);
      return `**${pageTitle}**\n\n${extract}`;
    },
  };
}
