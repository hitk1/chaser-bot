import { clearDatabase } from '../../../test/db-helpers';
import { prisma } from '../../../test/prisma';
import { FakeLlmService } from '../../../test/fakes/fake-llm.service';
import { makeAskQuestionUseCase, makeRepositories, defaultThrottle, defaultSessionInactivityMinutes } from '../../../test/use-case-factory';
import { GetFarmingStrategyUseCase } from './get-farming-strategy.use-case';

const defaultInput = {
  discordUserId: 'discord-farming-user',
  channelId: 'channel-1',
  username: 'Luís',
  throttle: defaultThrottle,
  sessionInactivityMinutes: defaultSessionInactivityMinutes,
};

describe('GetFarmingStrategyUseCase', () => {
  let llmService: FakeLlmService;
  let getFarmingStrategy: GetFarmingStrategyUseCase;

  beforeEach(async () => {
    await clearDatabase();
    llmService = new FakeLlmService();
    getFarmingStrategy = new GetFarmingStrategyUseCase(makeAskQuestionUseCase(llmService));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns the LLM answer', async () => {
    llmService.queueResponse('Farme no Dungeon das Sombras.');

    const output = await getFarmingStrategy.execute({ ...defaultInput, target: 'Gema Rúnica' });

    expect(output.answer).toBe('Farme no Dungeon das Sombras.');
  });

  it('builds the question including the target', async () => {
    llmService.queueResponse('resposta');

    const output = await getFarmingStrategy.execute({ ...defaultInput, target: 'Cristal Místico' });

    const { sessionRepository } = makeRepositories();
    const session = await sessionRepository.findById(output.sessionId);
    const userMessage = session!.messages.find((message) => message.role === 'user');
    expect(userMessage!.content).toContain('Cristal Místico');
  });
});
