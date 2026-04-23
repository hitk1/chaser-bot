export interface WikiSearchResult {
  pageTitle: string;
  extract: string;
}

export interface IWikiSearchService {
  search(topic: string): Promise<WikiSearchResult | null>;
}
