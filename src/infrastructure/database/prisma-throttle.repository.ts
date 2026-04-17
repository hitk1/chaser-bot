import { PrismaClient } from '@prisma/client';
import { RateLimitEntry } from '../../domain/throttle/throttle.entity';
import { IThrottleRepository } from '../../domain/throttle/throttle.repository';

export class PrismaThrottleRepository implements IThrottleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<RateLimitEntry | null> {
    const rateLimitRow = await this.prisma.rateLimitEntry.findUnique({ where: { userId } });
    if (!rateLimitRow) return null;
    return {
      id: rateLimitRow.id,
      userId: rateLimitRow.userId,
      requestTimestamps: JSON.parse(rateLimitRow.requestTimestamps) as number[],
      updatedAt: rateLimitRow.updatedAt,
    };
  }

  async upsert(entry: RateLimitEntry): Promise<void> {
    const serializedTimestamps = JSON.stringify(entry.requestTimestamps);
    await this.prisma.rateLimitEntry.upsert({
      where: { userId: entry.userId },
      update: { requestTimestamps: serializedTimestamps },
      create: { userId: entry.userId, requestTimestamps: serializedTimestamps },
    });
  }
}
