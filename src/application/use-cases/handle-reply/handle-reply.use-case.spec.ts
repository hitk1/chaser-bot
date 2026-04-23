import { clearDatabase } from '../../../test/db-helpers';
import { prisma } from '../../../test/prisma';
import { FakeLlmService } from '../../../test/fakes/fake-llm.service';
import {
  makeHandleReplyUseCase,
  makeAskQuestionUseCase,
  defaultThrottle,
  defaultSessionInactivityMinutes,
} from '../../../test/use-case-factory';
import { BASE_GRANDCHASE_SYSTEM_PROMPT } from '../../constants/game-prompts';

const defaultInput = {
  discordUserId: 'discord-reply-user',
  channelId: 'channel-reply',
  username: 'Luís',
  throttle: defaultThrottle,
  sessionInactivityMinutes: defaultSessionInactivityMinutes,
};

describe('HandleReplyUseCase', () => {
  let llmService: FakeLlmService;

  beforeEach(async () => {
    await clearDatabase();
    llmService = new FakeLlmService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns not-found message when discordMessageId has no matching session', async () => {
    const { useCase } = makeHandleReplyUseCase(llmService);

    const output = await useCase.execute({
      ...defaultInput,
      question: 'continuando...',
      repliedToMessageId: 'non-existent-discord-msg-id',
    });

    expect(output.sessionId).toBe('');
    expect(output.answer).toContain('Não encontrei a conversa original');
  });

  it('continues conversation in the correct session when discordMessageId matches', async () => {
    // Arrange: create a session with a linked Discord message ID simulating a prior /ask response
    llmService.queueResponse('Resposta inicial do bot.');
    const askQuestion = makeAskQuestionUseCase(llmService);
    const firstOutput = await askQuestion.execute({
      ...defaultInput,
      question: 'Qual a melhor build?',
      systemPrompt: BASE_GRANDCHASE_SYSTEM_PROMPT,
      forceNewSession: true,
    });

    // Link a fake Discord message ID to that session (simulates what CommandHandler does after editReply)
    const { sessionRepository } = makeHandleReplyUseCase(llmService);
    await sessionRepository.linkDiscordMessageToSession(firstOutput.sessionId, 'discord-msg-abc123');

    // Act: user replies to that Discord message
    llmService.queueResponse('Continuação da conversa.');
    const { useCase } = makeHandleReplyUseCase(llmService);
    const replyOutput = await useCase.execute({
      ...defaultInput,
      question: 'E para PvP?',
      repliedToMessageId: 'discord-msg-abc123',
    });

    // Assert: answer is the LLM response (conversation continued)
    expect(replyOutput.answer).toBe('Continuação da conversa.');
    expect(replyOutput.sessionId).toBe(firstOutput.sessionId);
  });

  it('sends previous conversation history to LLM when continuing a session', async () => {
    // Arrange: create a session with history
    llmService.queueResponse('Primeira resposta.');
    const askQuestion = makeAskQuestionUseCase(llmService);
    const firstOutput = await askQuestion.execute({
      ...defaultInput,
      question: 'Pergunta inicial',
      systemPrompt: BASE_GRANDCHASE_SYSTEM_PROMPT,
      forceNewSession: true,
    });

    const { sessionRepository } = makeHandleReplyUseCase(llmService);
    await sessionRepository.linkDiscordMessageToSession(firstOutput.sessionId, 'discord-msg-xyz');

    // Act
    llmService.queueResponse('Segunda resposta.');
    const { useCase } = makeHandleReplyUseCase(llmService);
    await useCase.execute({
      ...defaultInput,
      question: 'Pergunta de follow-up',
      repliedToMessageId: 'discord-msg-xyz',
    });

    // Assert: LLM received the session history (user + assistant from the first exchange)
    const sentMessages = llmService.lastMessages;
    const userMessages = sentMessages.filter((m) => m.role === 'user');
    const assistantMessages = sentMessages.filter((m) => m.role === 'assistant');

    expect(userMessages.some((m) => m.content === 'Pergunta inicial')).toBe(true);
    expect(assistantMessages.some((m) => m.content === 'Primeira resposta.')).toBe(true);
    expect(userMessages[userMessages.length - 1].content).toBe('Pergunta de follow-up');
  });

  it('returns throttle warning when user exceeds rate limit', async () => {
    const throttledInput = {
      ...defaultInput,
      throttle: { maxRequests: 1, windowSeconds: 60, warningMessageTemplate: 'Calma, {username}!' },
    };

    // Arrange: create session and link Discord message ID
    llmService.queueResponse('Resposta 1.');
    const askQuestion = makeAskQuestionUseCase(llmService);
    const firstOutput = await askQuestion.execute({
      ...throttledInput,
      question: 'Primeira pergunta',
      systemPrompt: BASE_GRANDCHASE_SYSTEM_PROMPT,
      forceNewSession: true,
    });

    const { sessionRepository } = makeHandleReplyUseCase(llmService);
    await sessionRepository.linkDiscordMessageToSession(firstOutput.sessionId, 'discord-msg-throttle');

    // Act: reply should be throttled (user already hit the limit)
    const { useCase } = makeHandleReplyUseCase(llmService);
    const blocked = await useCase.execute({
      ...throttledInput,
      question: 'Reply que será bloqueado',
      repliedToMessageId: 'discord-msg-throttle',
    });

    expect(blocked.warningMessage).toBe('Calma, Luís!');
    expect(blocked.answer).toBe('');
  });
});
