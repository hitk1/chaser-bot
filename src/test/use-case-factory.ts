import { prisma } from './prisma';
import { FakeLlmService } from './fakes/fake-llm.service';
import { FakeWikiSearchService } from './fakes/fake-wiki-search.service';
import { FakeWebSearchService } from './fakes/fake-web-search.service';
import { PrismaUserRepository } from '../infrastructure/database/prisma-user.repository';
import { PrismaSessionRepository } from '../infrastructure/database/prisma-session.repository';
import { PrismaThrottleRepository } from '../infrastructure/database/prisma-throttle.repository';
import { PrismaKnowledgeRepository } from '../infrastructure/database/prisma-knowledge.repository';
import { CheckThrottleUseCase } from '../application/use-cases/check-throttle/check-throttle.use-case';
import { ResolveActiveSessionUseCase } from '../application/use-cases/resolve-active-session/resolve-active-session.use-case';
import { AskQuestionUseCase } from '../application/use-cases/ask-question/ask-question.use-case';
import { SearchWikiUseCase } from '../application/use-cases/search-wiki/search-wiki.use-case';
import { SearchWebUseCase } from '../application/use-cases/search-web/search-web.use-case';
import { HandleReplyUseCase } from '../application/use-cases/handle-reply/handle-reply.use-case';
import { IWebSearchService } from '../application/ports/web-search.port';
import pino from 'pino';

const noopLogger = pino({ level: 'silent' });

export function makeRepositories() {
  return {
    userRepository: new PrismaUserRepository(prisma),
    sessionRepository: new PrismaSessionRepository(prisma),
    throttleRepository: new PrismaThrottleRepository(prisma),
    knowledgeRepository: new PrismaKnowledgeRepository(prisma),
  };
}

export function makeAskQuestionUseCase(llmService: FakeLlmService) {
  const { userRepository, sessionRepository, throttleRepository } = makeRepositories();
  const checkThrottle = new CheckThrottleUseCase(throttleRepository);
  const resolveActiveSession = new ResolveActiveSessionUseCase(userRepository, sessionRepository);
  return new AskQuestionUseCase(sessionRepository, resolveActiveSession, checkThrottle, llmService);
}

export function makeSearchWikiUseCase(llmService: FakeLlmService, wikiSearch?: FakeWikiSearchService) {
  const wikiSearchService = wikiSearch ?? new FakeWikiSearchService();
  const askQuestion = makeAskQuestionUseCase(llmService);
  return { useCase: new SearchWikiUseCase(wikiSearchService, askQuestion, noopLogger), wikiSearch: wikiSearchService };
}

export function makeSearchWebUseCase(llmService: FakeLlmService, webSearch?: FakeWebSearchService | null) {
  const webSearchService: IWebSearchService | null = webSearch === undefined ? new FakeWebSearchService() : webSearch;
  const askQuestion = makeAskQuestionUseCase(llmService);
  return { useCase: new SearchWebUseCase(webSearchService, askQuestion, noopLogger), webSearch: webSearchService };
}

export function makeHandleReplyUseCase(llmService: FakeLlmService) {
  const { sessionRepository } = makeRepositories();
  const askQuestion = makeAskQuestionUseCase(llmService);
  return { useCase: new HandleReplyUseCase(sessionRepository, askQuestion, noopLogger), sessionRepository };
}

export const defaultThrottle = {
  maxRequests: 5,
  windowSeconds: 60,
  warningMessageTemplate: 'Hey {username}, calma aí!',
};

export const defaultSessionInactivityMinutes = 10;
