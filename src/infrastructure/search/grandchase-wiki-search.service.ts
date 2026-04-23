import { Logger } from 'pino';
import { IWikiSearchService, WikiSearchResult } from '../../application/ports/wiki-search.port';

const WIKI_API_BASE = 'https://grandchase.fandom.com/api.php';

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
  extractUrl.searchParams.set('exsentences', '10');
  extractUrl.searchParams.set('explaintext', '1');
  extractUrl.searchParams.set('format', 'json');
  extractUrl.searchParams.set('origin', '*');

  const extractResponse = await fetch(extractUrl.toString());
  const extractData = (await extractResponse.json()) as MediaWikiQueryResponse;
  const pages = extractData.query?.pages ?? {};
  const page = Object.values(pages)[0];

  return page?.extract ?? 'No content found for this page.';
}

export class GrandChaseWikiSearchService implements IWikiSearchService {
  constructor(private readonly logger: Logger) {}

  async search(topic: string): Promise<WikiSearchResult | null> {
    this.logger.info({ topic }, '[GRANDCHASE-WIKI][SEARCH] Searching wiki page');

    const pageTitle = await searchWikiPage(topic);

    if (!pageTitle) {
      this.logger.info({ topic, found: false }, '[GRANDCHASE-WIKI][SEARCH] No page found');
      return null;
    }

    this.logger.info({ topic, pageTitle, found: true }, '[GRANDCHASE-WIKI][SEARCH] Page found, fetching extract');

    const extract = await fetchPageExtract(pageTitle);

    this.logger.info(
      { pageTitle, extractLength: extract.length },
      '[GRANDCHASE-WIKI][SEARCH] Extract fetched',
    );

    return { pageTitle, extract };
  }
}
