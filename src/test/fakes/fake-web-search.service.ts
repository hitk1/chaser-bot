import { IWebSearchService, SearchResult } from '../../application/ports/web-search.port';

export class FakeWebSearchService implements IWebSearchService {
  private results: SearchResult[] = [];
  lastSearchedQuery = '';

  setResults(results: SearchResult[]): this {
    this.results = results;
    return this;
  }

  async search(query: string): Promise<SearchResult[]> {
    this.lastSearchedQuery = query;
    return this.results;
  }
}
