import { clearDatabase } from '../../test/db-helpers';
import { prisma } from '../../test/prisma';
import { PrismaKnowledgeRepository } from './prisma-knowledge.repository';

const repo = new PrismaKnowledgeRepository(prisma);

const baseEntry = {
  source: 'user' as const,
  rawContent: 'Mago usa carta X no slot Y',
  sanitizedContent: 'Mago: carta X no slot Y',
  tags: ['mage', 'equipment', 'card'],
};

describe('PrismaKnowledgeRepository', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('create', () => {
    it('stores the entry and parses tags back as array', async () => {
      const entry = await repo.create(baseEntry);
      expect(entry.id).toBeDefined();
      expect(entry.source).toBe('user');
      expect(entry.tags).toEqual(['mage', 'equipment', 'card']);
      expect(entry.addedByUserId).toBeNull();
    });

    it('stores addedByUserId when provided', async () => {
      const entry = await repo.create({ ...baseEntry, addedByUserId: 'user-123' });
      expect(entry.addedByUserId).toBe('user-123');
    });
  });

  describe('findAll', () => {
    it('returns empty array when no entries exist', async () => {
      const result = await repo.findAll();
      expect(result).toHaveLength(0);
    });

    it('returns all entries ordered by createdAt desc', async () => {
      await prisma.knowledgeEntry.create({
        data: {
          source: 'user',
          rawContent: 'primeiro',
          sanitizedContent: 'primeiro',
          tags: JSON.stringify(['mage']),
          addedByUserId: null,
          createdAt: new Date(Date.now() - 5000),
        },
      });
      await repo.create({ ...baseEntry, rawContent: 'segundo' });
      const result = await repo.findAll();
      expect(result).toHaveLength(2);
      expect(result[0].rawContent).toBe('segundo');
    });
  });

  describe('searchByTags', () => {
    it('returns entries that match any of the provided keywords', async () => {
      await repo.create({ ...baseEntry, tags: ['mage', 'equipment'] });
      await repo.create({ ...baseEntry, tags: ['warrior', 'farming'] });

      const result = await repo.searchByTags(['mage']);
      expect(result).toHaveLength(1);
      expect(result[0].tags).toContain('mage');
    });

    it('returns empty array when no tags match', async () => {
      await repo.create(baseEntry);
      const result = await repo.searchByTags(['archer']);
      expect(result).toHaveLength(0);
    });

    it('is case-insensitive on tag matching', async () => {
      await repo.create({ ...baseEntry, tags: ['Mage'] });
      const result = await repo.searchByTags(['mage']);
      expect(result).toHaveLength(1);
    });
  });

  describe('delete', () => {
    it('removes the entry', async () => {
      const entry = await repo.create(baseEntry);
      await repo.delete(entry.id);
      const all = await repo.findAll();
      expect(all).toHaveLength(0);
    });
  });
});
