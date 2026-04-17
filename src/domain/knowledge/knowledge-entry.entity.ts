export type KnowledgeSource = 'user' | 'web' | 'wiki';

export interface KnowledgeEntry {
  id: string;
  source: KnowledgeSource;
  rawContent: string;
  sanitizedContent: string;
  tags: string[];
  addedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
