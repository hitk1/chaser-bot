import { Session } from '../../../domain/session/session.entity';
import { ISessionRepository } from '../../../domain/session/session.repository';
import { IUserRepository } from '../../../domain/user/user.repository';

export interface ListSessionsInput {
  discordUserId: string;
}

export class ListSessionsUseCase {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly sessionRepository: ISessionRepository,
  ) {}

  async execute(input: ListSessionsInput): Promise<Session[]> {
    const user = await this.userRepository.findOrCreate(input.discordUserId);
    return this.sessionRepository.findAllByUser(user.id);
  }
}
