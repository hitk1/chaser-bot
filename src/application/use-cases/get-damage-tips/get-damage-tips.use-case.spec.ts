import { clearDatabase } from '../../../test/db-helpers';
import { prisma } from '../../../test/prisma';
import { FakeLlmService } from '../../../test/fakes/fake-llm.service';
import { makeAskQuestionUseCase, makeRepositories, defaultThrottle, defaultSessionInactivityMinutes } from '../../../test/use-case-factory';
import { GetDamageTipsUseCase } from './get-damage-tips.use-case';

const defaultInput = {
  discordUserId: 'discord-damage-user',
  channelId: 'channel-1',
  username: 'Luís',
  throttle: defaultThrottle,
  sessionInactivityMinutes: defaultSessionInactivityMinutes,
};

describe('GetDamageTipsUseCase', () => {
  let llmService: FakeLlmService;
  let getDamageTips: GetDamageTipsUseCase;

  beforeEach(async () => {
    await clearDatabase();
    llmService = new FakeLlmService();
    getDamageTips = new GetDamageTipsUseCase(makeAskQuestionUseCase(llmService));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns the LLM answer', async () => {
    llmService.queueResponse('Use o combo habilidade 2 + habilidade 3 para burst.');

    const output = await getDamageTips.execute({ ...defaultInput, character: 'Lass' });

    expect(output.answer).toBe('Use o combo habilidade 2 + habilidade 3 para burst.');
  });

  it('builds the question including the character name', async () => {
    llmService.queueResponse('resposta');

    const output = await getDamageTips.execute({ ...defaultInput, character: 'Ryan' });

    const { sessionRepository } = makeRepositories();
    const session = await sessionRepository.findById(output.sessionId);
    const userMessage = session!.messages.find((message) => message.role === 'user');
    expect(userMessage!.content).toContain('Ryan');
  });
});
