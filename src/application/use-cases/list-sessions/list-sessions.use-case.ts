import { Session } from '../../../domain/session/session.entity';
import { ISessionRepository } from '../../../domain/session/session.repository';
import { IUserRepository } from '../../../domain/user/user.repository';
import { createLogger } from '../../../bootstrap/logger';

const logger = createLogger('list-sessions');

export interface ListSessionsInput {
  discordUserId: string;
}

export class ListSessionsUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(input: ListSessionsInput): Promise<Session[]> {
    const { discordUserId } = input;
    logger.info({ discordUserId }, '[LIST-SESSIONS][USE-CASE] Listing sessions');
    const user = await this.userRepository.findOrCreate(discordUserId);
    const sessions = await this.sessionRepository.findAllByUser(user.id);
    logger.info({ discordUserId, count: sessions.length }, '[LIST-SESSIONS][USE-CASE] Sessions listed');
    return sessions;
  }
}
