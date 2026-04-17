import { clearDatabase } from '../../../test/db-helpers';
import { prisma } from '../../../test/prisma';
import { makeRepositories } from '../../../test/use-case-factory';
import { ListSessionsUseCase } from './list-sessions.use-case';

describe('ListSessionsUseCase', () => {
  let listSessions: ListSessionsUseCase;

  beforeEach(async () => {
    await clearDatabase();
    const { userRepository, sessionRepository } = makeRepositories();
    listSessions = new ListSessionsUseCase(userRepository, sessionRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns empty array for a user with no sessions', async () => {
    const sessions = await listSessions.execute({ discordUserId: 'discord-no-sessions' });
    expect(sessions).toHaveLength(0);
  });

  it('returns all sessions belonging to the user', async () => {
    const { userRepository, sessionRepository } = makeRepositories();
    const user = await userRepository.findOrCreate('discord-with-sessions');
    await sessionRepository.create(user.id, 'channel-1');
    await sessionRepository.create(user.id, 'channel-2');

    const sessions = await listSessions.execute({ discordUserId: 'discord-with-sessions' });

    expect(sessions).toHaveLength(2);
  });

  it('does not return sessions belonging to other users', async () => {
    const { userRepository, sessionRepository } = makeRepositories();
    const otherUser = await userRepository.findOrCreate('discord-other-user');
    await sessionRepository.create(otherUser.id, 'channel-1');

    const sessions = await listSessions.execute({ discordUserId: 'discord-target-user' });

    expect(sessions).toHaveLength(0);
  });
});
