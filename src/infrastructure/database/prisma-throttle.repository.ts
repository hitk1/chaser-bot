import { PrismaClient } from '@prisma/client';
import { RateLimitEntry } from '../../domain/throttle/throttle.entity';
import { IThrottleRepository } from '../../domain/throttle/throttle.repository';

export class PrismaThrottleRepository implements IThrottleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<RateLimitEntry | null> {
    const row = await this.prisma.rateLimitEntry.findUnique({ where: { userId } });
    if (!row) return null;
    return {
      id: row.id,
      userId: row.userId,
      requestTimestamps: JSON.parse(row.requestTimestamps) as number[],
      updatedAt: row.updatedAt,
    };
  }

  async upsert(entry: RateLimitEntry): Promise<void> {
    const timestamps = JSON.stringify(entry.requestTimestamps);
    await this.prisma.rateLimitEntry.upsert({
      where: { userId: entry.userId },
      update: { requestTimestamps: timestamps },
      create: { userId: entry.userId, requestTimestamps: timestamps },
    });
  }
}
