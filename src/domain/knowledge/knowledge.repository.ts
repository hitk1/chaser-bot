import { KnowledgeEntry, KnowledgeSource } from './knowledge-entry.entity';

export interface CreateKnowledgeEntryProps {
  source: KnowledgeSource;
  rawContent: string;
  sanitizedContent: string;
  tags: string[];
  addedByUserId?: string;
}

export interface IKnowledgeRepository {
  create(props: CreateKnowledgeEntryProps): Promise<KnowledgeEntry>;
  searchByTags(keywords: string[]): Promise<KnowledgeEntry[]>;
  findAll(): Promise<KnowledgeEntry[]>;
  delete(id: string): Promise<void>;
}
