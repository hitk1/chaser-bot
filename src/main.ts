import 'dotenv/config'
import { REST, Routes } from 'discord.js';
import { config } from './bootstrap/env';
import { createLogger } from './bootstrap/logger';
import { prisma } from './bootstrap/prisma-client';
import { createDiscordClient } from './bootstrap/discord-client';
import { createOpenAiClient } from './bootstrap/openai-client';
import { PrismaUserRepository } from './infrastructure/database/prisma-user.repository';
import { PrismaSessionRepository } from './infrastructure/database/prisma-session.repository';
import { PrismaThrottleRepository } from './infrastructure/database/prisma-throttle.repository';
import { PrismaKnowledgeRepository } from './infrastructure/database/prisma-knowledge.repository';
import { FunctionRegistry } from './infrastructure/llm/function-registry';
import { createWebSearchFunction } from './infrastructure/llm/functions/web-search.function';
import { createKnowledgeLookupFunction } from './infrastructure/llm/functions/knowledge-lookup.function';
import { createGrandChaseWikiFunction } from './infrastructure/llm/functions/grandchase-wiki.function';
import { BraveSearchService } from './infrastructure/search/brave-search.service';
import { OpenAiLlmService } from './infrastructure/llm/openai-llm.service';
import { CheckThrottleUseCase } from './application/use-cases/check-throttle/check-throttle.use-case';
import { ResolveActiveSessionUseCase } from './application/use-cases/resolve-active-session/resolve-active-session.use-case';
import { AskQuestionUseCase } from './application/use-cases/ask-question/ask-question.use-case';
import { GetEquipmentAdviceUseCase } from './application/use-cases/get-equipment-advice/get-equipment-advice.use-case';
import { GetFarmingStrategyUseCase } from './application/use-cases/get-farming-strategy/get-farming-strategy.use-case';
import { GetDamageTipsUseCase } from './application/use-cases/get-damage-tips/get-damage-tips.use-case';
import { AddKnowledgeUseCase } from './application/use-cases/add-knowledge/add-knowledge.use-case';
import { ListSessionsUseCase } from './application/use-cases/list-sessions/list-sessions.use-case';
import { SwitchSessionUseCase } from './application/use-cases/switch-session/switch-session.use-case';
import { DeleteSessionUseCase } from './application/use-cases/delete-session/delete-session.use-case';
import { CommandHandler } from './presentation/discord/command-handler';
import { EventHandler } from './presentation/discord/event-handler';
import { askCommand } from './presentation/discord/commands/ask.command';
import { equipmentCommand } from './presentation/discord/commands/equipment.command';
import { farmingCommand } from './presentation/discord/commands/farming.command';
import { damageCommand } from './presentation/discord/commands/damage.command';
import { addKnowledgeCommand } from './presentation/discord/commands/add-knowledge.command';
import { sessionCommand } from './presentation/discord/commands/session.command';
import { helpCommand } from './presentation/discord/commands/help.command';

const logger = createLogger('main');

async function bootstrap() {
  logger.info({ nodeEnv: config.NODE_ENV, logLevel: config.LOG_LEVEL }, 'Starting chaser-bot');

  try {
    // 1. Connect database
    await prisma.$connect();
    logger.info('Database connected');

    // 2. Create repositories
    const userRepository = new PrismaUserRepository(prisma);
    const sessionRepository = new PrismaSessionRepository(prisma);
    const throttleRepository = new PrismaThrottleRepository(prisma);
    const knowledgeRepository = new PrismaKnowledgeRepository(prisma);

    // 3. Build function registry
    const registry = new FunctionRegistry();
    registry.register('grandchase_wiki', createGrandChaseWikiFunction());
    registry.register('knowledge_lookup', createKnowledgeLookupFunction(knowledgeRepository));
    if (config.SEARCH_API_KEY) {
      const searchService = new BraveSearchService(config.SEARCH_API_KEY);
      registry.register('web_search', createWebSearchFunction(searchService));
      logger.info('Web search function registered');
    }

    // 4. Create LLM service
    const openai = createOpenAiClient(config);
    const llmService = new OpenAiLlmService(
      openai,
      registry,
      config.OPENAI_MODEL,
      config.OPENAI_MAX_TOKENS,
    );

    // 5. Build use cases in dependency order
    const checkThrottle = new CheckThrottleUseCase(throttleRepository);
    const resolveActiveSession = new ResolveActiveSessionUseCase(userRepository, sessionRepository);
    const askQuestion = new AskQuestionUseCase(
      sessionRepository,
      resolveActiveSession,
      checkThrottle,
      llmService,
    );
    const getEquipmentAdvice = new GetEquipmentAdviceUseCase(askQuestion);
    const getFarmingStrategy = new GetFarmingStrategyUseCase(askQuestion);
    const getDamageTips = new GetDamageTipsUseCase(askQuestion);
    const addKnowledge = new AddKnowledgeUseCase(knowledgeRepository, llmService);
    const listSessions = new ListSessionsUseCase(userRepository, sessionRepository);
    const switchSession = new SwitchSessionUseCase(userRepository, sessionRepository);
    const deleteSession = new DeleteSessionUseCase(userRepository, sessionRepository);

    // 6. Build command config
    const commandConfig = {
      throttle: {
        maxRequests: config.THROTTLE_MAX_REQUESTS,
        windowSeconds: config.THROTTLE_WINDOW_SECONDS,
        warningMessageTemplate: config.THROTTLE_WARNING_MESSAGE,
      },
      sessionInactivityMinutes: config.SESSION_INACTIVITY_MINUTES,
    };

    // 7. Create presentation layer
    const commandHandler = new CommandHandler(
      {
        askQuestion,
        getEquipmentAdvice,
        getFarmingStrategy,
        getDamageTips,
        addKnowledge,
        listSessions,
        switchSession,
        deleteSession,
      },
      commandConfig,
      createLogger('command-handler'),
    );

    // 8. Build command registrar — registers slash commands to a guild on demand
    const commandBodies = [
      askCommand,
      equipmentCommand,
      farmingCommand,
      damageCommand,
      addKnowledgeCommand,
      sessionCommand,
      helpCommand,
    ].map((c) => c.toJSON());

    const rest = new REST().setToken(config.DISCORD_BOT_TOKEN);
    const registrar = {
      registerForGuild: async (guildId: string) => {
        await rest.put(
          Routes.applicationGuildCommands(config.DISCORD_CLIENT_ID, guildId),
          { body: commandBodies },
        );
        logger.info({ guildId, count: commandBodies.length }, 'Commands registered for guild');
      },
    };

    const client = createDiscordClient();
    const eventHandler = new EventHandler(
      client,
      commandHandler,
      createLogger('event-handler'),
      registrar,
    );
    eventHandler.register();

    // 9. Login to Discord
    await client.login(config.DISCORD_BOT_TOKEN);

    // 10. Graceful shutdown
    const shutdown = async () => {
      logger.info('Shutting down...');
      client.destroy();
      await prisma.$disconnect();
      process.exit(0);
    };

    process.once('SIGINT', shutdown);
    process.once('SIGTERM', shutdown);
  } catch (error) {
    logger.error({ error }, 'Failed to start application');
    process.exit(1);
  }
}

bootstrap();
