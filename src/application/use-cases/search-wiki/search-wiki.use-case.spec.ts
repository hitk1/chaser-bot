import { clearDatabase } from '../../../test/db-helpers';
import { prisma } from '../../../test/prisma';
import { FakeLlmService } from '../../../test/fakes/fake-llm.service';
import { FakeWikiSearchService } from '../../../test/fakes/fake-wiki-search.service';
import {
  makeSearchWikiUseCase,
  defaultThrottle,
  defaultSessionInactivityMinutes,
} from '../../../test/use-case-factory';

const defaultInput = {
  discordUserId: 'discord-wiki-user',
  channelId: 'channel-wiki',
  username: 'Luís',
  throttle: defaultThrottle,
  sessionInactivityMinutes: defaultSessionInactivityMinutes,
};

describe('SearchWikiUseCase', () => {
  let llmService: FakeLlmService;
  let wikiSearch: FakeWikiSearchService;

  beforeEach(async () => {
    await clearDatabase();
    llmService = new FakeLlmService();
    wikiSearch = new FakeWikiSearchService();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('injects wiki result into system prompt when page is found', async () => {
    wikiSearch.setResult({ pageTitle: 'Elesis', extract: 'Elesis é uma guerreira de Kanavan.' });
    llmService.queueResponse('Elesis é a protagonista do jogo.');
    const { useCase } = makeSearchWikiUseCase(llmService, wikiSearch);

    await useCase.execute({ ...defaultInput, question: 'quem é Elesis?' });

    const systemMessage = llmService.lastMessages[0];
    expect(systemMessage.role).toBe('system');
    expect(systemMessage.content).toContain('**Elesis**');
    expect(systemMessage.content).toContain('Elesis é uma guerreira de Kanavan.');
  });

  it('injects no-result warning when wiki page is not found', async () => {
    wikiSearch.setResult(null);
    llmService.queueResponse('Não encontrei na wiki.');
    const { useCase } = makeSearchWikiUseCase(llmService, wikiSearch);

    await useCase.execute({ ...defaultInput, question: 'boss xyzabc' });

    const systemMessage = llmService.lastMessages[0];
    expect(systemMessage.content).toContain('Nenhum resultado encontrado na wiki');
    expect(systemMessage.content).toContain('boss xyzabc');
  });

  it('searches wiki using the user question as topic', async () => {
    wikiSearch.setResult(null);
    llmService.queueResponse('ok');
    const { useCase } = makeSearchWikiUseCase(llmService, wikiSearch);

    await useCase.execute({ ...defaultInput, question: 'dungeon Kounat' });

    expect(wikiSearch.lastSearchedTopic).toBe('dungeon Kounat');
  });

  it('preserves the user question in the LLM user message', async () => {
    wikiSearch.setResult(null);
    llmService.queueResponse('resposta');
    const { useCase } = makeSearchWikiUseCase(llmService, wikiSearch);

    await useCase.execute({ ...defaultInput, question: 'como subir level rápido?' });

    const userMessage = llmService.lastMessages[llmService.lastMessages.length - 1];
    expect(userMessage.role).toBe('user');
    expect(userMessage.content).toBe('como subir level rápido?');
  });

  it('returns the LLM answer', async () => {
    wikiSearch.setResult({ pageTitle: 'Test', extract: 'content' });
    llmService.queueResponse('Resposta sobre a wiki');
    const { useCase } = makeSearchWikiUseCase(llmService, wikiSearch);

    const output = await useCase.execute({ ...defaultInput, question: 'pergunta' });

    expect(output.answer).toBe('Resposta sobre a wiki');
  });

  it('returns warning message and no answer when throttled', async () => {
    const throttledInput = {
      ...defaultInput,
      throttle: { maxRequests: 1, windowSeconds: 60, warningMessageTemplate: 'Calma, {username}!' },
    };
    wikiSearch.setResult(null);
    llmService.queueResponse('r1');
    const { useCase } = makeSearchWikiUseCase(llmService, wikiSearch);

    await useCase.execute({ ...throttledInput, question: 'q1' });
    const blocked = await useCase.execute({ ...throttledInput, question: 'q2' });

    expect(blocked.answer).toBe('');
    expect(blocked.warningMessage).toBe('Calma, Luís!');
  });
});
