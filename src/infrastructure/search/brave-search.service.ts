import { Logger } from 'pino';
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
  constructor(
    private readonly apiKey: string,
    private readonly logger: Logger,
  ) {}

  async search(query: string): Promise<SearchResult[]> {
    this.logger.info({ query, maxResults: MAX_RESULTS }, '[BRAVE-SEARCH][SEARCH] Sending search request');

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
      this.logger.error(
        { query, status: response.status, statusText: response.statusText },
        '[BRAVE-SEARCH][SEARCH] API request failed',
      );
      throw new Error(`Brave Search API error: ${response.status} ${response.statusText}`);
    }

    const data = (await response.json()) as BraveSearchResponse;
    const webResults = data.web?.results ?? [];
    const results = webResults.slice(0, MAX_RESULTS).map((result) => ({
      title: result.title,
      snippet: result.description,
      url: result.url,
    }));

    this.logger.info(
      { query, resultCount: results.length, urls: results.map((r) => r.url) },
      '[BRAVE-SEARCH][SEARCH] Search results received',
    );

    return results;
  }
}
