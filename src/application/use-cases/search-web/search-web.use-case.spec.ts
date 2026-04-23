import { clearDatabase } from '../../../test/db-helpers';
import { prisma } from '../../../test/prisma';
import { FakeLlmService } from '../../../test/fakes/fake-llm.service';
import { FakeWebSearchService } from '../../../test/fakes/fake-web-search.service';
import {
  makeSearchWebUseCase,
  defaultThrottle,
  defaultSessionInactivityMinutes,
} from '../../../test/use-case-factory';

const defaultInput = {
  discordUserId: 'discord-web-user',
  channelId: 'channel-web',
  username: 'Luís',
  throttle: defaultThrottle,
  sessionInactivityMinutes: defaultSessionInactivityMinutes,
};

describe('SearchWebUseCase', () => {
  let llmService: FakeLlmService;
  let webSearch: FakeWebSearchService;

  beforeEach(async () => {
    await clearDatabase();
    llmService = new FakeLlmService();
    webSearch = new FakeWebSearchService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('injects web results into system prompt when results are found', async () => {
    webSearch.setResults([
      { title: 'Best Elesis Build', snippet: 'Use sword cards.', url: 'https://reddit.com/r/Grandchase/123' },
    ]);
    llmService.queueResponse('Use cartas de espada.');
    const { useCase } = makeSearchWebUseCase(llmService, webSearch);

    await useCase.execute({ ...defaultInput, question: 'melhor build Elesis?' });

    const systemMessage = llmService.lastMessages[0];
    expect(systemMessage.role).toBe('system');
    expect(systemMessage.content).toContain('Best Elesis Build');
    expect(systemMessage.content).toContain('Use sword cards.');
    expect(systemMessage.content).toContain('https://reddit.com/r/Grandchase/123');
  });

  it('injects no-results warning when search returns empty', async () => {
    webSearch.setResults([]);
    llmService.queueResponse('Não encontrei nada.');
    const { useCase } = makeSearchWebUseCase(llmService, webSearch);

    await useCase.execute({ ...defaultInput, question: 'personagem xyz' });

    const systemMessage = llmService.lastMessages[0];
    expect(systemMessage.content).toContain('AVISO: Nenhum resultado encontrado');
  });

  it('prefixes the search query with "GrandChase"', async () => {
    webSearch.setResults([]);
    llmService.queueResponse('ok');
    const { useCase } = makeSearchWebUseCase(llmService, webSearch);

    await useCase.execute({ ...defaultInput, question: 'melhor dungeon' });

    expect(webSearch.lastSearchedQuery).toMatch(/^GrandChase /);
    expect(webSearch.lastSearchedQuery).toContain('melhor dungeon');
  });

  it('still calls LLM when webSearch is null (no API key)', async () => {
    llmService.queueResponse('Respondendo sem busca.');
    const { useCase } = makeSearchWebUseCase(llmService, null);

    const output = await useCase.execute({ ...defaultInput, question: 'pergunta' });

    expect(output.answer).toBe('Respondendo sem busca.');
    const systemMessage = llmService.lastMessages[0];
    expect(systemMessage.content).toContain('AVISO: Nenhum resultado encontrado');
  });

  it('proceeds with empty results if web search throws', async () => {
    webSearch.setResults([]); // override below via jest mock
    jest.spyOn(webSearch, 'search').mockRejectedValueOnce(new Error('API error'));
    llmService.queueResponse('fallback');
    const { useCase } = makeSearchWebUseCase(llmService, webSearch);

    const output = await useCase.execute({ ...defaultInput, question: 'pergunta' });

    expect(output.answer).toBe('fallback');
    const systemMessage = llmService.lastMessages[0];
    expect(systemMessage.content).toContain('AVISO: Nenhum resultado encontrado');
  });

  it('preserves the user question in the LLM user message', async () => {
    webSearch.setResults([]);
    llmService.queueResponse('resposta');
    const { useCase } = makeSearchWebUseCase(llmService, webSearch);

    await useCase.execute({ ...defaultInput, question: 'como farmar moedas?' });

    const userMessage = llmService.lastMessages[llmService.lastMessages.length - 1];
    expect(userMessage.role).toBe('user');
    expect(userMessage.content).toBe('como farmar moedas?');
  });

  it('returns warning message and no answer when throttled', async () => {
    const throttledInput = {
      ...defaultInput,
      throttle: { maxRequests: 1, windowSeconds: 60, warningMessageTemplate: 'Calma, {username}!' },
    };
    webSearch.setResults([]);
    llmService.queueResponse('r1');
    const { useCase } = makeSearchWebUseCase(llmService, webSearch);

    await useCase.execute({ ...throttledInput, question: 'q1' });
    const blocked = await useCase.execute({ ...throttledInput, question: 'q2' });

    expect(blocked.answer).toBe('');
    expect(blocked.warningMessage).toBe('Calma, Luís!');
  });
});
