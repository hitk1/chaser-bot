import { PrismaClient } from '@prisma/client';
import { RateLimitEntry } from '../../domain/throttle/throttle.entity';
import { IThrottleRepository } from '../../domain/throttle/throttle.repository';
import { createLogger } from '../../bootstrap/logger';

const logger = createLogger('throttle-repository');

export class PrismaThrottleRepository implements IThrottleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findByUserId(userId: string): Promise<RateLimitEntry | null> {
    logger.info({ userId }, '[THROTTLE][REPOSITORY] findByUserId');
    const rateLimitRow = await this.prisma.rateLimitEntry.findUnique({ where: { userId } });
    if (!rateLimitRow) {
      logger.info({ userId, found: false }, '[THROTTLE][REPOSITORY] findByUserId result');
      return null;
    }
    const timestamps = JSON.parse(rateLimitRow.requestTimestamps) as number[];
    logger.info(
      { userId, found: true, timestampCount: timestamps.length },
      '[THROTTLE][REPOSITORY] findByUserId result',
    );
    return {
      id: rateLimitRow.id,
      userId: rateLimitRow.userId,
      requestTimestamps: timestamps,
      updatedAt: rateLimitRow.updatedAt,
    };
  }

  async upsert(entry: RateLimitEntry): Promise<void> {
    logger.info(
      { userId: entry.userId, timestampCount: entry.requestTimestamps.length },
      '[THROTTLE][REPOSITORY] upsert',
    );
    const serializedTimestamps = JSON.stringify(entry.requestTimestamps);
    await this.prisma.rateLimitEntry.upsert({
      where: { userId: entry.userId },
      update: { requestTimestamps: serializedTimestamps },
      create: { userId: entry.userId, requestTimestamps: serializedTimestamps },
    });
  }
}
