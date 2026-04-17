import { Session } from '../../../domain/session/session.entity';
import { ISessionRepository } from '../../../domain/session/session.repository';
import { IUserRepository } from '../../../domain/user/user.repository';

export interface SwitchSessionInput {
  sessionId: string;
  discordUserId: string;
  channelId: string;
}

export class SwitchSessionUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(input: SwitchSessionInput): Promise<Session> {
    const { sessionId, discordUserId, channelId } = input;

    const user = await this.userRepository.findOrCreate(discordUserId);

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.userId !== user.id) {
      throw new Error('This session does not belong to you');
    }

    return this.sessionRepository.switchToChannel(sessionId, channelId);
  }
}
