import { prisma } from './prisma';
import { FakeLlmService } from './fakes/fake-llm.service';
import { PrismaUserRepository } from '../infrastructure/database/prisma-user.repository';
import { PrismaSessionRepository } from '../infrastructure/database/prisma-session.repository';
import { PrismaThrottleRepository } from '../infrastructure/database/prisma-throttle.repository';
import { PrismaKnowledgeRepository } from '../infrastructure/database/prisma-knowledge.repository';
import { CheckThrottleUseCase } from '../application/use-cases/check-throttle/check-throttle.use-case';
import { ResolveActiveSessionUseCase } from '../application/use-cases/resolve-active-session/resolve-active-session.use-case';
import { AskQuestionUseCase } from '../application/use-cases/ask-question/ask-question.use-case';

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

export const defaultThrottle = {
  maxRequests: 5,
  windowSeconds: 60,
  warningMessageTemplate: 'Hey {username}, calma aí!',
};

export const defaultSessionInactivityMinutes = 10;
