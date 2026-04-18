import { User } from '../../../domain/user/user.entity';
import { IUserRepository } from '../../../domain/user/user.repository';
import { Session } from '../../../domain/session/session.entity';
import { ISessionRepository } from '../../../domain/session/session.repository';
import { createLogger } from '../../../bootstrap/logger';

const logger = createLogger('resolve-session');

export interface ResolveActiveSessionInput {
  discordUserId: string;
  channelId: string;
  sessionInactivityMinutes: number;
}

export interface ResolveActiveSessionOutput {
  session: Session;
  user: User;
  isNewSession: boolean;
}

export class ResolveActiveSessionUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(input: ResolveActiveSessionInput): Promise<ResolveActiveSessionOutput> {
    const { discordUserId, channelId, sessionInactivityMinutes } = input;

    logger.info({ discordUserId, channelId }, '[RESOLVE-SESSION][USE-CASE] Resolving active session');

    const user = await this.userRepository.findOrCreate(discordUserId);
    const latestSession = await this.sessionRepository.findLatestByUserAndChannel(
      user.id,
      channelId,
    );

    if (latestSession && latestSession.isActive(sessionInactivityMinutes)) {
      logger.info(
        { discordUserId, sessionId: latestSession.id, isNewSession: false },
        '[RESOLVE-SESSION][USE-CASE] Session resolved',
      );
      return { session: latestSession, user, isNewSession: false };
    }

    const newSession = await this.sessionRepository.create(user.id, channelId);
    logger.info(
      { discordUserId, sessionId: newSession.id, isNewSession: true },
      '[RESOLVE-SESSION][USE-CASE] Session resolved',
    );
    return { session: newSession, user, isNewSession: true };
  }
}
