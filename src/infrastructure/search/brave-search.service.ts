import { IWebSearchService, SearchResult } from '../../application/ports/web-search.port';

interface BraveWebResult {
  title: string;
  description: string;
  url: string;
}

interface BraveSearchResponse {
  web?: {
    results?: BraveWebResult[];
  };
}

const BRAVE_SEARCH_API_URL = 'https://api.search.brave.com/res/v1/web/search';
const MAX_RESULTS = 3;

export class BraveSearchService implements IWebSearchService {
  constructor(private readonly apiKey: string) {}

  async search(query: string): Promise<SearchResult[]> {
    const requestUrl = new URL(BRAVE_SEARCH_API_URL);
    requestUrl.searchParams.set('q', query);
    requestUrl.searchParams.set('count', String(MAX_RESULTS));

    const response = await fetch(requestUrl.toString(), {
      headers: {
        Accept: 'application/json',
        'Accept-Encoding': 'gzip',
        'X-Subscription-Token': this.apiKey,
      },
    });

    if (!response.ok) {
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as BraveSearchResponse;
    const webResults = data.web?.results ?? [];

    return webResults.slice(0, MAX_RESULTS).map((result) => ({
      title: result.title,
      snippet: result.description,
      url: result.url,
    }));
  }
}
