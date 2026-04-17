import { clearDatabase } from '../../../test/db-helpers';
import { prisma } from '../../../test/prisma';
import { makeRepositories, defaultThrottle } from '../../../test/use-case-factory';
import { CheckThrottleUseCase } from './check-throttle.use-case';

describe('CheckThrottleUseCase', () => {
  let checkThrottle: CheckThrottleUseCase;
  let userId: string;

  beforeEach(async () => {
    await clearDatabase();
    const { userRepository, throttleRepository } = makeRepositories();
    checkThrottle = new CheckThrottleUseCase(throttleRepository);
    const user = await userRepository.findOrCreate('discord-throttle-check');
    userId = user.id;
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('allows the first request when no entry exists', async () => {
    const result = await checkThrottle.execute({
      userId,
      username: 'Luís',
      config: defaultThrottle,
    });
    expect(result.allowed).toBe(true);
  });

  it('persists the timestamp after an allowed request', async () => {
    await checkThrottle.execute({ userId, username: 'Luís', config: defaultThrottle });

    const { throttleRepository } = makeRepositories();
    const entry = await throttleRepository.findByUserId(userId);
    expect(entry!.requestTimestamps).toHaveLength(1);
  });

  it('allows requests while under the limit', async () => {
    for (let requestNumber = 0; requestNumber < 4; requestNumber++) {
      await checkThrottle.execute({ userId, username: 'Luís', config: defaultThrottle });
    }
    const result = await checkThrottle.execute({ userId, username: 'Luís', config: defaultThrottle });
    expect(result.allowed).toBe(true);
  });

  it('blocks when the limit is reached', async () => {
    for (let requestNumber = 0; requestNumber < defaultThrottle.maxRequests; requestNumber++) {
      await checkThrottle.execute({ userId, username: 'Luís', config: defaultThrottle });
    }
    const result = await checkThrottle.execute({ userId, username: 'Luís', config: defaultThrottle });
    expect(result.allowed).toBe(false);
  });

  it('returns the interpolated warning message when blocked', async () => {
    for (let requestNumber = 0; requestNumber < defaultThrottle.maxRequests; requestNumber++) {
      await checkThrottle.execute({ userId, username: 'Luís', config: defaultThrottle });
    }
    const result = await checkThrottle.execute({ userId, username: 'Luís', config: defaultThrottle });
    expect(result.warningMessage).toBe('Hey Luís, calma aí!');
  });

  it('does not persist a timestamp when a request is blocked', async () => {
    for (let requestNumber = 0; requestNumber < defaultThrottle.maxRequests; requestNumber++) {
      await checkThrottle.execute({ userId, username: 'Luís', config: defaultThrottle });
    }
    await checkThrottle.execute({ userId, username: 'Luís', config: defaultThrottle });

    const { throttleRepository } = makeRepositories();
    const entry = await throttleRepository.findByUserId(userId);
    expect(entry!.requestTimestamps).toHaveLength(defaultThrottle.maxRequests);
  });
});
