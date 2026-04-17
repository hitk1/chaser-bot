import { clearDatabase } from '../../../test/db-helpers';
import { prisma } from '../../../test/prisma';
import { FakeLlmService } from '../../../test/fakes/fake-llm.service';
import { makeAskQuestionUseCase, defaultThrottle, defaultSessionInactivityMinutes } from '../../../test/use-case-factory';
import { GetEquipmentAdviceUseCase } from './get-equipment-advice.use-case';

const defaultInput = {
  discordUserId: 'discord-equipment-user',
  channelId: 'channel-1',
  username: 'Luís',
  throttle: defaultThrottle,
  sessionInactivityMinutes: defaultSessionInactivityMinutes,
};

describe('GetEquipmentAdviceUseCase', () => {
  let llmService: FakeLlmService;
  let getEquipmentAdvice: GetEquipmentAdviceUseCase;

  beforeEach(async () => {
    await clearDatabase();
    llmService = new FakeLlmService();
    getEquipmentAdvice = new GetEquipmentAdviceUseCase(makeAskQuestionUseCase(llmService));
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns the LLM answer', async () => {
    llmService.queueResponse('Use a carta Lâmina Rúnica no slot 3.');

    const output = await getEquipmentAdvice.execute({ ...defaultInput, character: 'Elesis', slot: 'slot 3' });

    expect(output.answer).toBe('Use a carta Lâmina Rúnica no slot 3.');
  });

  it('builds the question including character and slot', async () => {
    let capturedQuestion = '';
    llmService.queueResponse('resposta');

    const output = await getEquipmentAdvice.execute({ ...defaultInput, character: 'Arme', slot: 'slot 1' });

    // Verify through the persisted message that the question was built correctly
    const { sessionRepository } = (await import('../../../test/use-case-factory')).makeRepositories();
    const session = await sessionRepository.findById(output.sessionId);
    const userMessage = session!.messages.find((message) => message.role === 'user');
    expect(userMessage!.content).toContain('Arme');
    expect(userMessage!.content).toContain('slot 1');
  });
});
