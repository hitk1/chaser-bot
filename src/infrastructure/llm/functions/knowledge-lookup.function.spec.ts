import { KnowledgeEntry, KnowledgeSource } from '../../../domain/knowledge/knowledge-entry.entity';
import { IKnowledgeRepository } from '../../../domain/knowledge/knowledge.repository';
import { createKnowledgeLookupFunction } from './knowledge-lookup.function';

class FakeKnowledgeRepository implements IKnowledgeRepository {
  private readonly entries: KnowledgeEntry[];

  constructor(entries: KnowledgeEntry[] = []) {
    this.entries = entries;
  }

  async create(): Promise<KnowledgeEntry> {
    throw new Error('not implemented in fake');
  }

  async searchByTags(keywords: string[]): Promise<KnowledgeEntry[]> {
    const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());
    return this.entries.filter((entry) =>
      entry.tags.some((tag) => lowerKeywords.includes(tag.toLowerCase())),
    );
  }

  async findAll(): Promise<KnowledgeEntry[]> {
    return this.entries;
  }

  async delete(): Promise<void> {
    throw new Error('not implemented in fake');
  }
}

function makeKnowledgeEntry(overrides: Partial<KnowledgeEntry> = {}): KnowledgeEntry {
  return {
    id: 'entry-1',
    source: 'user' as KnowledgeSource,
    rawContent: 'raw content',
    sanitizedContent: 'Mago usa carta X no slot Y',
    tags: ['mage', 'equipment'],
    addedByUserId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

describe('createKnowledgeLookupFunction', () => {
  it('creates a function with the name knowledge_lookup', () => {
    const knowledgeLookupFunction = createKnowledgeLookupFunction(new FakeKnowledgeRepository());
    expect(knowledgeLookupFunction.definition.function.name).toBe('knowledge_lookup');
  });

  it('returns sanitized content for matching entries', async () => {
    const entries = [
      makeKnowledgeEntry({ sanitizedContent: 'Mago usa carta X no slot Y', tags: ['mage'] }),
      makeKnowledgeEntry({ id: 'entry-2', sanitizedContent: 'Guerreiro usa armadura Z', tags: ['warrior'] }),
    ];
    const knowledgeLookupFunction = createKnowledgeLookupFunction(new FakeKnowledgeRepository(entries));

    const result = await knowledgeLookupFunction.execute({ keywords: ['mage'] });

    expect(result).toContain('Mago usa carta X no slot Y');
    expect(result).not.toContain('Guerreiro usa armadura Z');
  });

  it('joins multiple matching entries with a separator', async () => {
    const entries = [
      makeKnowledgeEntry({ id: 'e1', sanitizedContent: 'Dica 1', tags: ['mage'] }),
      makeKnowledgeEntry({ id: 'e2', sanitizedContent: 'Dica 2', tags: ['mage'] }),
    ];
    const knowledgeLookupFunction = createKnowledgeLookupFunction(new FakeKnowledgeRepository(entries));

    const result = await knowledgeLookupFunction.execute({ keywords: ['mage'] });

    expect(result).toContain('Dica 1');
    expect(result).toContain('Dica 2');
    expect(result).toContain('---');
  });

  it('returns a not-found message when no entries match', async () => {
    const knowledgeLookupFunction = createKnowledgeLookupFunction(new FakeKnowledgeRepository([]));
    const result = await knowledgeLookupFunction.execute({ keywords: ['archer'] });
    expect(result).toContain('No curated knowledge found');
  });
});
