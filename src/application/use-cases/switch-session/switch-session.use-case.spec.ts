import { clearDatabase } from '../../../test/db-helpers';
import { prisma } from '../../../test/prisma';
import { makeRepositories } from '../../../test/use-case-factory';
import { SwitchSessionUseCase } from './switch-session.use-case';

describe('SwitchSessionUseCase', () => {
  let switchSession: SwitchSessionUseCase;

  beforeEach(async () => {
    await clearDatabase();
    const { userRepository, sessionRepository } = makeRepositories();
    switchSession = new SwitchSessionUseCase(userRepository, sessionRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns the switched session with updated channelId and lastActiveAt', async () => {
    const { userRepository, sessionRepository } = makeRepositories();
    const user = await userRepository.findOrCreate('discord-switch-user');

    await prisma.session.update({
      where: { id: (await sessionRepository.create(user.id, 'channel-old')).id },
      data: { lastActiveAt: new Date(Date.now() - 30 * 60 * 1000) },
    });

    const oldSession = await sessionRepository.create(user.id, 'channel-old');
    const beforeSwitch = new Date();

    const result = await switchSession.execute({
      sessionId: oldSession.id,
      discordUserId: 'discord-switch-user',
      channelId: 'channel-new',
    });

    expect(result.channelId).toBe('channel-new');
    expect(result.lastActiveAt.getTime()).toBeGreaterThanOrEqual(beforeSwitch.getTime());
  });

  it('makes the switched session the latest for the new channel', async () => {
    const { userRepository, sessionRepository } = makeRepositories();
    const user = await userRepository.findOrCreate('discord-switch-latest');
    const targetSession = await sessionRepository.create(user.id, 'channel-old');

    await prisma.session.update({
      where: { id: targetSession.id },
      data: { lastActiveAt: new Date(Date.now() - 30 * 60 * 1000) },
    });

    await switchSession.execute({
      sessionId: targetSession.id,
      discordUserId: 'discord-switch-latest',
      channelId: 'channel-new',
    });

    const latest = await sessionRepository.findLatestByUserAndChannel(user.id, 'channel-new');
    expect(latest!.id).toBe(targetSession.id);
  });

  it('throws when the session does not exist', async () => {
    await expect(
      switchSession.execute({
        sessionId: 'ghost-session-id',
        discordUserId: 'discord-switch-user',
        channelId: 'channel-1',
      }),
    ).rejects.toThrow('not found');
  });

  it('throws when the session belongs to a different user', async () => {
    const { userRepository, sessionRepository } = makeRepositories();
    const ownerUser = await userRepository.findOrCreate('discord-owner');
    const session = await sessionRepository.create(ownerUser.id, 'channel-1');

    await expect(
      switchSession.execute({
        sessionId: session.id,
        discordUserId: 'discord-intruder',
        channelId: 'channel-1',
      }),
    ).rejects.toThrow('does not belong to you');
  });
});
