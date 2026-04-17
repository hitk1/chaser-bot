import { PrismaClient } from '@prisma/client';
import { User } from '../../domain/user/user.entity';
import { IUserRepository } from '../../domain/user/user.repository';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findOrCreate(discordUserId: string): Promise<User> {
    return this.prisma.user.upsert({
      where: { discordUserId },
      update: {},
      create: { discordUserId },
    });
  }

  async findByDiscordId(discordUserId: string): Promise<User | null> {
    return this.prisma.user.findUnique({ where: { discordUserId } });
  }
}
