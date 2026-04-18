import { PrismaClient } from '@prisma/client';
import { User } from '../../domain/user/user.entity';
import { IUserRepository } from '../../domain/user/user.repository';
import { createLogger } from '../../bootstrap/logger';

const logger = createLogger('user-repository');

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOrCreate(discordUserId: string): Promise<User> {
    logger.info({ discordUserId }, '[USER][REPOSITORY] findOrCreate');
    const user = await this.prisma.user.upsert({
      where: { discordUserId },
      update: {},
      create: { discordUserId },
    });
    logger.info({ discordUserId, userId: user.id }, '[USER][REPOSITORY] findOrCreate result');
    return user;
  }

  async findByDiscordId(discordUserId: string): Promise<User | null> {
    logger.info({ discordUserId }, '[USER][REPOSITORY] findByDiscordId');
    const user = await this.prisma.user.findUnique({ where: { discordUserId } });
    logger.info({ discordUserId, found: !!user }, '[USER][REPOSITORY] findByDiscordId result');
    return user;
  }
}
