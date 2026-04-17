import { User } from './user.entity';

export interface IUserRepository {
  findOrCreate(discordUserId: string): Promise<User>;
  findByDiscordId(discordUserId: string): Promise<User | null>;
}
