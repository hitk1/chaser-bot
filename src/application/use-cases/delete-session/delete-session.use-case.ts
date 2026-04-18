import { ISessionRepository } from '../../../domain/session/session.repository';
import { IUserRepository } from '../../../domain/user/user.repository';
import { createLogger } from '../../../bootstrap/logger';

const logger = createLogger('delete-session');

export interface DeleteSessionInput {
  sessionId: string;
  discordUserId: string;
}

export class DeleteSessionUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(input: DeleteSessionInput): Promise<void> {
    const { sessionId, discordUserId } = input;

    logger.info({ discordUserId, sessionId }, '[DELETE-SESSION][USE-CASE] Deleting session');
    const user = await this.userRepository.findOrCreate(discordUserId);

    const session = await this.sessionRepository.findById(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    if (session.userId !== user.id) {
      throw new Error('This session does not belong to you');
    }

    await this.sessionRepository.delete(sessionId);
    logger.info({ discordUserId, sessionId }, '[DELETE-SESSION][USE-CASE] Session deleted');
  }
}
