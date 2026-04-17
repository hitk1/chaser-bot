import { clearDatabase } from '../../../test/db-helpers';
import { prisma } from '../../../test/prisma';
import { FakeLlmService } from '../../../test/fakes/fake-llm.service';
import {
  makeAskQuestionUseCase,
  makeRepositories,
  defaultThrottle,
  defaultSessionInactivityMinutes,
} from '../../../test/use-case-factory';
import { BASE_GRANDCHASE_SYSTEM_PROMPT } from '../../constants/game-prompts';

const defaultInput = {
  discordUserId: 'discord-ask-user',
  channelId: 'channel-1',
  username: 'Luís',
  systemPrompt: BASE_GRANDCHASE_SYSTEM_PROMPT,
  throttle: defaultThrottle,
  sessionInactivityMinutes: defaultSessionInactivityMinutes,
};

describe('AskQuestionUseCase', () => {
  let llmService: FakeLlmService;

  beforeEach(async () => {
    await clearDatabase();
    llmService = new FakeLlmService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns the LLM answer', async () => {
    llmService.queueResponse('Use a carta de Mago no slot 3.');
    const askQuestion = makeAskQuestionUseCase(llmService);

    const output = await askQuestion.execute({ ...defaultInput, question: 'qual a melhor carta?' });

    expect(output.answer).toBe('Use a carta de Mago no slot 3.');
  });

  it('returns a session id', async () => {
    llmService.queueResponse('resposta');
    const askQuestion = makeAskQuestionUseCase(llmService);

    const output = await askQuestion.execute({ ...defaultInput, question: 'pergunta' });

    expect(output.sessionId).toBeDefined();
  });

  it('persists user and assistant messages to the database', async () => {
    llmService.queueResponse('Resposta do bot');
    const askQuestion = makeAskQuestionUseCase(llmService);

    const output = await askQuestion.execute({ ...defaultInput, question: 'Pergunta do usuário' });

    const { sessionRepository } = makeRepositories();
    const session = await sessionRepository.findById(output.sessionId);
    expect(session!.messages).toHaveLength(2);
    expect(session!.messages[0].role).toBe('user');
    expect(session!.messages[0].content).toBe('Pergunta do usuário');
    expect(session!.messages[1].role).toBe('assistant');
    expect(session!.messages[1].content).toBe('Resposta do bot');
  });

  it('auto-generates the session title from the first question', async () => {
    llmService.queueResponse('ok');
    const askQuestion = makeAskQuestionUseCase(llmService);

    const output = await askQuestion.execute({ ...defaultInput, question: 'qual o melhor set para mago?' });

    const { sessionRepository } = makeRepositories();
    const session = await sessionRepository.findById(output.sessionId);
    expect(session!.title).toBe('qual o melhor set para mago?');
  });

  it('reuses the active session on consecutive questions', async () => {
    llmService.queueResponse('resposta 1');
    llmService.queueResponse('resposta 2');
    const askQuestion = makeAskQuestionUseCase(llmService);

    const first = await askQuestion.execute({ ...defaultInput, question: 'pergunta 1' });
    const second = await askQuestion.execute({ ...defaultInput, question: 'pergunta 2' });

    expect(second.sessionId).toBe(first.sessionId);

    const { sessionRepository } = makeRepositories();
    const session = await sessionRepository.findById(first.sessionId);
    expect(session!.messages).toHaveLength(4);
  });

  it('creates a new session after the inactivity window expires', async () => {
    llmService.queueResponse('resposta 1');
    llmService.queueResponse('resposta 2');
    const askQuestion = makeAskQuestionUseCase(llmService);

    const first = await askQuestion.execute({ ...defaultInput, question: 'pergunta 1' });

    await prisma.session.update({
      where: { id: first.sessionId },
      data: { lastActiveAt: new Date(Date.now() - 11 * 60 * 1000) },
    });

    const second = await askQuestion.execute({ ...defaultInput, question: 'pergunta 2' });

    expect(second.sessionId).not.toBe(first.sessionId);
  });

  it('returns a warning message and no answer when throttle limit is reached', async () => {
    const askQuestion = makeAskQuestionUseCase(llmService);
    const throttledInput = {
      ...defaultInput,
      throttle: { maxRequests: 2, windowSeconds: 60, warningMessageTemplate: 'Calma, {username}!' },
    };

    llmService.queueResponse('r1');
    llmService.queueResponse('r2');
    await askQuestion.execute({ ...throttledInput, question: 'q1' });
    await askQuestion.execute({ ...throttledInput, question: 'q2' });

    const blockedOutput = await askQuestion.execute({ ...throttledInput, question: 'q3' });

    expect(blockedOutput.answer).toBe('');
    expect(blockedOutput.warningMessage).toBe('Calma, Luís!');
  });
});
