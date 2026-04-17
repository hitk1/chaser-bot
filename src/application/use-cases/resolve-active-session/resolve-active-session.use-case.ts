import { User } from '../../../domain/user/user.entity';
import { IUserRepository } from '../../../domain/user/user.repository';
import { Session } from '../../../domain/session/session.entity';
import { ISessionRepository } from '../../../domain/session/session.repository';

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

    const user = await this.userRepository.findOrCreate(discordUserId);
    const latestSession = await this.sessionRepository.findLatestByUserAndChannel(
      user.id,
      channelId,
    );

    if (latestSession && latestSession.isActive(sessionInactivityMinutes)) {
      return { session: latestSession, user, isNewSession: false };
    }

    const newSession = await this.sessionRepository.create(user.id, channelId);
    return { session: newSession, user, isNewSession: true };
  }
}
