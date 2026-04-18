import { PrismaClient } from '@prisma/client';
import { KnowledgeEntry, KnowledgeSource } from '../../domain/knowledge/knowledge-entry.entity';
import {
  CreateKnowledgeEntryProps,
  IKnowledgeRepository,
} from '../../domain/knowledge/knowledge.repository';
import { createLogger } from '../../bootstrap/logger';

const logger = createLogger('knowledge-repository');

type PrismaKnowledgeEntry = {
  id: string;
  source: string;
  rawContent: string;
  sanitizedContent: string;
  tags: string;
  addedByUserId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

function toKnowledgeEntry(prismaEntry: PrismaKnowledgeEntry): KnowledgeEntry {
  return {
    id: prismaEntry.id,
    source: prismaEntry.source as KnowledgeSource,
    rawContent: prismaEntry.rawContent,
    sanitizedContent: prismaEntry.sanitizedContent,
    tags: JSON.parse(prismaEntry.tags) as string[],
    addedByUserId: prismaEntry.addedByUserId,
    createdAt: prismaEntry.createdAt,
    updatedAt: prismaEntry.updatedAt,
  };
}

export class PrismaKnowledgeRepository implements IKnowledgeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(props: CreateKnowledgeEntryProps): Promise<KnowledgeEntry> {
    logger.info(
      { source: props.source, tagCount: props.tags.length, addedByUserId: props.addedByUserId },
      '[KNOWLEDGE][REPOSITORY] create',
    );
    const createdEntry = await this.prisma.knowledgeEntry.create({
      data: {
        source: props.source,
        rawContent: props.rawContent,
        sanitizedContent: props.sanitizedContent,
        tags: JSON.stringify(props.tags),
        addedByUserId: props.addedByUserId ?? null,
      },
    });
    logger.info({ id: createdEntry.id }, '[KNOWLEDGE][REPOSITORY] create result');
    return toKnowledgeEntry(createdEntry);
  }

  async searchByTags(keywords: string[]): Promise<KnowledgeEntry[]> {
    logger.info({ keywords }, '[KNOWLEDGE][REPOSITORY] searchByTags');
    const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());
    const allEntries = await this.prisma.knowledgeEntry.findMany();
    const filtered = allEntries
      .filter((entry) => {
        const tags = JSON.parse(entry.tags) as string[];
        return tags.some((tag) => lowerKeywords.includes(tag.toLowerCase()));
      })
      .map(toKnowledgeEntry);
    logger.info({ keywords, count: filtered.length }, '[KNOWLEDGE][REPOSITORY] searchByTags result');
    return filtered;
  }

  async findAll(): Promise<KnowledgeEntry[]> {
    logger.info({}, '[KNOWLEDGE][REPOSITORY] findAll');
    const entries = await this.prisma.knowledgeEntry.findMany({ orderBy: { createdAt: 'desc' } });
    logger.info({ count: entries.length }, '[KNOWLEDGE][REPOSITORY] findAll result');
    return entries.map(toKnowledgeEntry);
  }

  async delete(id: string): Promise<void> {
    logger.info({ id }, '[KNOWLEDGE][REPOSITORY] delete');
    await this.prisma.knowledgeEntry.delete({ where: { id } });
  }
}
