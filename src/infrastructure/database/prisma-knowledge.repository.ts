import { PrismaClient } from '@prisma/client';
import { KnowledgeEntry, KnowledgeSource } from '../../domain/knowledge/knowledge-entry.entity';
import {
  CreateKnowledgeEntryProps,
  IKnowledgeRepository,
} from '../../domain/knowledge/knowledge.repository';

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
    const createdEntry = await this.prisma.knowledgeEntry.create({
      data: {
        source: props.source,
        rawContent: props.rawContent,
        sanitizedContent: props.sanitizedContent,
        tags: JSON.stringify(props.tags),
        addedByUserId: props.addedByUserId ?? null,
      },
    });
    return toKnowledgeEntry(createdEntry);
  }

  async searchByTags(keywords: string[]): Promise<KnowledgeEntry[]> {
    const lowerKeywords = keywords.map((keyword) => keyword.toLowerCase());
    const allEntries = await this.prisma.knowledgeEntry.findMany();
    return allEntries
      .filter((entry) => {
        const tags = JSON.parse(entry.tags) as string[];
        return tags.some((tag) => lowerKeywords.includes(tag.toLowerCase()));
      })
      .map(toKnowledgeEntry);
  }

  async findAll(): Promise<KnowledgeEntry[]> {
    const entries = await this.prisma.knowledgeEntry.findMany({ orderBy: { createdAt: 'desc' } });
    return entries.map(toKnowledgeEntry);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.knowledgeEntry.delete({ where: { id } });
  }
}
