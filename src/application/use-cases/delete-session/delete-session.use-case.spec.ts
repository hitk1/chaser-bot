import { clearDatabase } from '../../../test/db-helpers';
import { prisma } from '../../../test/prisma';
import { makeRepositories } from '../../../test/use-case-factory';
import { DeleteSessionUseCase } from './delete-session.use-case';

describe('DeleteSessionUseCase', () => {
  let deleteSession: DeleteSessionUseCase;

  beforeEach(async () => {
    await clearDatabase();
    const { userRepository, sessionRepository } = makeRepositories();
    deleteSession = new DeleteSessionUseCase(userRepository, sessionRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('removes the session from the database', async () => {
    const { userRepository, sessionRepository } = makeRepositories();
    const user = await userRepository.findOrCreate('discord-delete-user');
    const session = await sessionRepository.create(user.id, 'channel-1');

    await deleteSession.execute({ sessionId: session.id, discordUserId: 'discord-delete-user' });

    const found = await sessionRepository.findById(session.id);
    expect(found).toBeNull();
  });

  it('throws when the session does not exist', async () => {
    await expect(
      deleteSession.execute({ sessionId: 'ghost-id', discordUserId: 'discord-delete-user' }),
    ).rejects.toThrow('not found');
  });

  it('throws when the session belongs to a different user', async () => {
    const { userRepository, sessionRepository } = makeRepositories();
    const ownerUser = await userRepository.findOrCreate('discord-owner-del');
    const session = await sessionRepository.create(ownerUser.id, 'channel-1');

    await expect(
      deleteSession.execute({ sessionId: session.id, discordUserId: 'discord-intruder-del' }),
    ).rejects.toThrow('does not belong to you');
  });
});
