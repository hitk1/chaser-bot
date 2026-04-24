import { clearDatabase } from '../../../test/db-helpers';
import { prisma } from '../../../test/prisma';
import { makeRepositories, defaultSessionInactivityMinutes } from '../../../test/use-case-factory';
import { ResolveActiveSessionUseCase } from './resolve-active-session.use-case';

describe('ResolveActiveSessionUseCase', () => {
  let resolveActiveSession: ResolveActiveSessionUseCase;

  beforeEach(async () => {
    await clearDatabase();
    const { userRepository, sessionRepository } = makeRepositories();
    resolveActiveSession = new ResolveActiveSessionUseCase(userRepository, sessionRepository);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('creates a new session for a first-time user', async () => {
    const output = await resolveActiveSession.execute({
      discordUserId: 'discord-new-user',
      channelId: 'channel-1',
      sessionInactivityMinutes: defaultSessionInactivityMinutes,
    });

    expect(output.session.id).toBeDefined();
    expect(output.isNewSession).toBe(true);
  });

  it('reuses the existing session when it is still active', async () => {
    const first = await resolveActiveSession.execute({
      discordUserId: 'discord-active-user',
      channelId: 'channel-1',
      sessionInactivityMinutes: defaultSessionInactivityMinutes,
    });

    const second = await resolveActiveSession.execute({
      discordUserId: 'discord-active-user',
      channelId: 'channel-1',
      sessionInactivityMinutes: defaultSessionInactivityMinutes,
    });

    expect(second.session.id).toBe(first.session.id);
    expect(second.isNewSession).toBe(false);
  });

  it('creates a new session when the previous one is inactive', async () => {
    const { userRepository, sessionRepository } = makeRepositories();
    const user = await userRepository.findOrCreate('discord-inactive-user');
    const oldSession = await sessionRepository.create(user.id, 'channel-1');

    await prisma.session.update({
      where: { id: oldSession.id },
      data: { lastActiveAt: new Date(Date.now() - 11 * 60 * 1000) },
    });

    const output = await resolveActiveSession.execute({
      discordUserId: 'discord-inactive-user',
      channelId: 'channel-1',
      sessionInactivityMinutes: defaultSessionInactivityMinutes,
    });

    expect(output.session.id).not.toBe(oldSession.id);
    expect(output.isNewSession).toBe(true);
  });

  it('returns the user alongside the session', async () => {
    const output = await resolveActiveSession.execute({
      discordUserId: 'discord-user-check',
      channelId: 'channel-1',
      sessionInactivityMinutes: defaultSessionInactivityMinutes,
    });

    expect(output.user.discordUserId).toBe('discord-user-check');
  });

  it('creates independent sessions for different channels', async () => {
    const channelA = await resolveActiveSession.execute({
      discordUserId: 'discord-multichannel',
      channelId: 'channel-A',
      sessionInactivityMinutes: defaultSessionInactivityMinutes,
    });
    const channelB = await resolveActiveSession.execute({
      discordUserId: 'discord-multichannel',
      channelId: 'channel-B',
      sessionInactivityMinutes: defaultSessionInactivityMinutes,
    });

    expect(channelA.session.id).not.toBe(channelB.session.id);
  });

  describe('forceNewSession', () => {
    it('always creates a new session even when an active one exists', async () => {
      const first = await resolveActiveSession.execute({
        discordUserId: 'discord-force-user',
        channelId: 'channel-1',
        sessionInactivityMinutes: defaultSessionInactivityMinutes,
      });

      const second = await resolveActiveSession.execute({
        discordUserId: 'discord-force-user',
        channelId: 'channel-1',
        sessionInactivityMinutes: defaultSessionInactivityMinutes,
        forceNewSession: true,
      });

      expect(second.session.id).not.toBe(first.session.id);
      expect(second.isNewSession).toBe(true);
    });

    it('creates multiple independent sessions for repeated calls', async () => {
      const { sessionRepository } = makeRepositories();

      for (let i = 0; i < 3; i++) {
        await resolveActiveSession.execute({
          discordUserId: 'discord-multi-session',
          channelId: 'channel-1',
          sessionInactivityMinutes: defaultSessionInactivityMinutes,
          forceNewSession: true,
        });
      }

      const user = await makeRepositories().userRepository.findOrCreate('discord-multi-session');
      const sessions = await sessionRepository.findAllByUser(user.id);
      expect(sessions).toHaveLength(3);
    });
  });

  describe('existingSessionId', () => {
    it('returns the specified session by ID', async () => {
      const { sessionRepository } = makeRepositories();
      const user = await makeRepositories().userRepository.findOrCreate('discord-existing-user');
      const created = await sessionRepository.create(user.id, 'channel-1');

      const output = await resolveActiveSession.execute({
        discordUserId: 'discord-existing-user',
        channelId: 'channel-1',
        sessionInactivityMinutes: defaultSessionInactivityMinutes,
        existingSessionId: created.id,
      });

      expect(output.session.id).toBe(created.id);
      expect(output.isNewSession).toBe(false);
    });

    it('throws when existingSessionId points to a non-existent session', async () => {
      await expect(
        resolveActiveSession.execute({
          discordUserId: 'discord-existing-user',
          channelId: 'channel-1',
          sessionInactivityMinutes: defaultSessionInactivityMinutes,
          existingSessionId: 'non-existent-session-id',
        }),
      ).rejects.toThrow('non-existent-session-id');
    });
  });
});
