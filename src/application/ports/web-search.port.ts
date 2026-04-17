export interface SearchResult {
  title: string;
  snippet: string;
  url: string;
}

export interface IWebSearchService {
  search(query: string): Promise<SearchResult[]>;
}
