import { IWebSearchService, SearchResult } from '../../../application/ports/web-search.port';
import { createWebSearchFunction } from './web-search.function';

class FakeWebSearchService implements IWebSearchService {
  private readonly results: SearchResult[];

  constructor(results: SearchResult[] = []) {
    this.results = results;
  }

  async search(_query: string): Promise<SearchResult[]> {
    return this.results;
  }
}

describe('createWebSearchFunction', () => {
  it('creates a function with the name web_search', () => {
    const webSearchFunction = createWebSearchFunction(new FakeWebSearchService());
    expect(webSearchFunction.definition.function.name).toBe('web_search');
  });

  it('returns formatted results when the search service returns matches', async () => {
    const fakeResults: SearchResult[] = [
      { title: 'GrandChase Mage Guide', snippet: 'Best cards for mage.', url: 'https://example.com/1' },
      { title: 'Equipment Overview', snippet: 'Slot explanations.', url: 'https://example.com/2' },
    ];
    const webSearchFunction = createWebSearchFunction(new FakeWebSearchService(fakeResults));

    const result = await webSearchFunction.execute({ query: 'mage equipment' });

    expect(result).toContain('GrandChase Mage Guide');
    expect(result).toContain('Best cards for mage.');
    expect(result).toContain('https://example.com/1');
    expect(result).toContain('Equipment Overview');
  });

  it('returns a no-results message when the search service returns empty', async () => {
    const webSearchFunction = createWebSearchFunction(new FakeWebSearchService([]));
    const result = await webSearchFunction.execute({ query: 'anything' });
    expect(result).toContain('No results found');
  });
});
