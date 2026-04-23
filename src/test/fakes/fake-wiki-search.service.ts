import { IWikiSearchService, WikiSearchResult } from '../../application/ports/wiki-search.port';

export class FakeWikiSearchService implements IWikiSearchService {
  private result: WikiSearchResult | null = null;
  lastSearchedTopic = '';

  setResult(result: WikiSearchResult | null): this {
    this.result = result;
    return this;
  }

  async search(topic: string): Promise<WikiSearchResult | null> {
    this.lastSearchedTopic = topic;
    return this.result;
  }
}
