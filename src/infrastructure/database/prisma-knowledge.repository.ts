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

function toEntry(k: PrismaKnowledgeEntry): KnowledgeEntry {
  return {
    id: k.id,
    source: k.source as KnowledgeSource,
    rawContent: k.rawContent,
    sanitizedContent: k.sanitizedContent,
    tags: JSON.parse(k.tags) as string[],
    addedByUserId: k.addedByUserId,
    createdAt: k.createdAt,
    updatedAt: k.updatedAt,
  };
}

export class PrismaKnowledgeRepository implements IKnowledgeRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(props: CreateKnowledgeEntryProps): Promise<KnowledgeEntry> {
    const k = await this.prisma.knowledgeEntry.create({
      data: {
        source: props.source,
        rawContent: props.rawContent,
        sanitizedContent: props.sanitizedContent,
        tags: JSON.stringify(props.tags),
        addedByUserId: props.addedByUserId ?? null,
      },
    });
    return toEntry(k);
  }

  async searchByTags(keywords: string[]): Promise<KnowledgeEntry[]> {
    const lower = keywords.map((k) => k.toLowerCase());
    const all = await this.prisma.knowledgeEntry.findMany();
    return all
      .filter((entry) => {
        const tags = JSON.parse(entry.tags) as string[];
        return tags.some((tag) => lower.includes(tag.toLowerCase()));
      })
      .map(toEntry);
  }

  async findAll(): Promise<KnowledgeEntry[]> {
    const rows = await this.prisma.knowledgeEntry.findMany({ orderBy: { createdAt: 'desc' } });
    return rows.map(toEntry);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.knowledgeEntry.delete({ where: { id } });
  }
}
