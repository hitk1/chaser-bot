import { KnowledgeEntry } from '../../../domain/knowledge/knowledge-entry.entity';

export interface AddKnowledgeInput {
  rawContent: string;
  addedByUserId?: string;
}

export type AddKnowledgeOutput = KnowledgeEntry;
