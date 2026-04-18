import { ChatInputCommandInteraction } from 'discord.js';
import { clearDatabase } from '../../test/db-helpers';
import { FakeLlmService } from '../../test/fakes/fake-llm.service';
import {
  makeRepositories,
  defaultThrottle,
  defaultSessionInactivityMinutes,
} from '../../test/use-case-factory';
import { CheckThrottleUseCase } from '../../application/use-cases/check-throttle/check-throttle.use-case';
import { ResolveActiveSessionUseCase } from '../../application/use-cases/resolve-active-session/resolve-active-session.use-case';
import { AskQuestionUseCase } from '../../application/use-cases/ask-question/ask-question.use-case';
import { GetEquipmentAdviceUseCase } from '../../application/use-cases/get-equipment-advice/get-equipment-advice.use-case';
import { GetFarmingStrategyUseCase } from '../../application/use-cases/get-farming-strategy/get-farming-strategy.use-case';
import { GetDamageTipsUseCase } from '../../application/use-cases/get-damage-tips/get-damage-tips.use-case';
import { AddKnowledgeUseCase } from '../../application/use-cases/add-knowledge/add-knowledge.use-case';
import { ListSessionsUseCase } from '../../application/use-cases/list-sessions/list-sessions.use-case';
import { SwitchSessionUseCase } from '../../application/use-cases/switch-session/switch-session.use-case';
import { DeleteSessionUseCase } from '../../application/use-cases/delete-session/delete-session.use-case';
import { CommandHandler, CommandConfig } from './command-handler';
import pino from 'pino';

// ---------------------------------------------------------------------------
// FakeDiscordInteraction — real interface, no jest.fn()
// ---------------------------------------------------------------------------

class FakeDiscordInteraction {
  commandName: string;
  user = { id: 'discord-test-user', username: 'Tester' };
  channelId = 'channel-test';

  private _reply = '';
  private _deferred = false;
  private _opts: Record<string, string | null>;
  private _subcommand: string | null;

  options: {
    getString(name: string, required?: boolean): string | null;
    getSubcommand(): string;
  };

  constructor(
    cmd: string,
    opts: Record<string, string | null> = {},
    sub: string | null = null,
  ) {
    this.commandName = cmd;
    this._opts = opts;
    this._subcommand = sub;

    const self = this;
    this.options = {
      getString(name: string): string | null {
        return self._opts[name] ?? null;
      },
      getSubcommand(): string {
        return self._subcommand ?? '';
      },
    };
  }

  async deferReply(): Promise<void> {
    this._deferred = true;
  }

  async editReply(content: string): Promise<void> {
    this._reply = content;
  }

  getReply(): string {
    return this._reply;
  }

  isDeferred(): boolean {
    return this._deferred;
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const nullLogger = pino({ level: 'silent' });

function makeCommandHandler(llmService: FakeLlmService): CommandHandler {
  const repos = makeRepositories();
  const checkThrottle = new CheckThrottleUseCase(repos.throttleRepository);
  const resolveActiveSession = new ResolveActiveSessionUseCase(
    repos.userRepository,
    repos.sessionRepository,
  );
  const askQuestion = new AskQuestionUseCase(
    repos.sessionRepository,
    resolveActiveSession,
    checkThrottle,
    llmService,
  );
  const getEquipmentAdvice = new GetEquipmentAdviceUseCase(askQuestion);
  const getFarmingStrategy = new GetFarmingStrategyUseCase(askQuestion);
  const getDamageTips = new GetDamageTipsUseCase(askQuestion);
  const addKnowledge = new AddKnowledgeUseCase(repos.knowledgeRepository, llmService);
  const listSessions = new ListSessionsUseCase(repos.userRepository, repos.sessionRepository);
  const switchSession = new SwitchSessionUseCase(repos.userRepository, repos.sessionRepository);
  const deleteSession = new DeleteSessionUseCase(repos.userRepository, repos.sessionRepository);

  const commandConfig: CommandConfig = {
    throttle: defaultThrottle,
    sessionInactivityMinutes: defaultSessionInactivityMinutes,
  };

  return new CommandHandler(
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
    nullLogger,
  );
}

function asInteraction(fake: FakeDiscordInteraction): ChatInputCommandInteraction {
  return fake as unknown as ChatInputCommandInteraction;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CommandHandler', () => {
  beforeEach(async () => {
    await clearDatabase();
  });

  describe('/ask', () => {
    it('defers first, then puts LLM answer in editReply', async () => {
      const llm = new FakeLlmService().queueResponse('Resposta sobre GrandChase');
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction('ask', { question: 'Qual o melhor mago?' });

      await handler.handle(asInteraction(interaction));

      expect(interaction.isDeferred()).toBe(true);
      expect(interaction.getReply()).toBe('Resposta sobre GrandChase');
    });

    it('returns throttle warning when user is rate-limited', async () => {
      const llm = new FakeLlmService();
      // Queue enough responses to exhaust the throttle limit (5) + warning response
      for (let i = 0; i < defaultThrottle.maxRequests; i++) {
        llm.queueResponse(`Resposta ${i + 1}`);
      }

      const handler = makeCommandHandler(llm);

      // Exhaust the throttle
      for (let i = 0; i < defaultThrottle.maxRequests; i++) {
        const req = new FakeDiscordInteraction('ask', { question: `Pergunta ${i + 1}` });
        await handler.handle(asInteraction(req));
      }

      // This request should be throttled
      const throttled = new FakeDiscordInteraction('ask', { question: 'Pergunta extra' });
      await handler.handle(asInteraction(throttled));

      expect(throttled.getReply()).toContain('Tester');
    });
  });

  describe('/equipment', () => {
    it('returns answer from use case', async () => {
      const llm = new FakeLlmService().queueResponse('Use carta X no slot Y');
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction('equipment', {
        character: 'Elesis',
        slot: 'weapon',
      });

      await handler.handle(asInteraction(interaction));

      expect(interaction.isDeferred()).toBe(true);
      expect(interaction.getReply()).toBe('Use carta X no slot Y');
    });
  });

  describe('/farming', () => {
    it('returns answer from use case', async () => {
      const llm = new FakeLlmService().queueResponse('Farme em Dungeon Z');
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction('farming', { target: 'Gem of Agility' });

      await handler.handle(asInteraction(interaction));

      expect(interaction.getReply()).toBe('Farme em Dungeon Z');
    });
  });

  describe('/damage', () => {
    it('returns answer from use case', async () => {
      const llm = new FakeLlmService().queueResponse('Use habilidade A e combo B');
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction('damage', { character: 'Lire' });

      await handler.handle(asInteraction(interaction));

      expect(interaction.getReply()).toBe('Use habilidade A e combo B');
    });
  });

  describe('/add-knowledge', () => {
    it('confirms entry saved with tag count', async () => {
      const llm = new FakeLlmService().queueResponse(
        '{"sanitizedContent":"Elesis usa carta X","tags":["elesis","carta","equipment"]}',
      );
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction('add-knowledge', {
        content: 'Elesis usa carta X no slot principal',
      });

      await handler.handle(asInteraction(interaction));

      expect(interaction.isDeferred()).toBe(true);
      expect(interaction.getReply()).toContain('3 tags');
      expect(interaction.getReply()).toContain('elesis');
    });
  });

  describe('/session list', () => {
    it('reports no sessions when user has none', async () => {
      const llm = new FakeLlmService();
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction('session', {}, 'list');

      await handler.handle(asInteraction(interaction));

      expect(interaction.getReply()).toBe('Nenhuma sessão encontrada.');
    });

    it('lists sessions with bullet format when sessions exist', async () => {
      const llm = new FakeLlmService().queueResponse('Resposta');
      const handler = makeCommandHandler(llm);

      // Create a session via /ask
      const ask = new FakeDiscordInteraction('ask', { question: 'Qual o melhor mago?' });
      await handler.handle(asInteraction(ask));

      const list = new FakeDiscordInteraction('session', {}, 'list');
      await handler.handle(asInteraction(list));

      expect(list.getReply()).toContain('•');
      expect(list.getReply()).toContain('`');
    });
  });

  describe('/session delete', () => {
    it('confirms deletion of a known session', async () => {
      const llm = new FakeLlmService().queueResponse('Resposta');
      const handler = makeCommandHandler(llm);

      // Create session via /ask
      const ask = new FakeDiscordInteraction('ask', { question: 'Teste' });
      await handler.handle(asInteraction(ask));

      // Get the session id via /session list
      const list = new FakeDiscordInteraction('session', {}, 'list');
      await handler.handle(asInteraction(list));
      const replyText = list.getReply();
      const match = replyText.match(/`([^`]+)`/);
      const sessionId = match![1];

      const del = new FakeDiscordInteraction('session', { session_id: sessionId }, 'delete');
      await handler.handle(asInteraction(del));

      expect(del.getReply()).toContain('deletada com sucesso');
    });

    it('returns error message for unknown session id', async () => {
      const llm = new FakeLlmService();
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction(
        'session',
        { session_id: 'nonexistent-id' },
        'delete',
      );

      await handler.handle(asInteraction(interaction));

      expect(interaction.getReply()).toContain('not found');
    });
  });

  describe('/session switch', () => {
    it('activates an existing session', async () => {
      const llm = new FakeLlmService().queueResponse('Resposta');
      const handler = makeCommandHandler(llm);

      // Create a session
      const ask = new FakeDiscordInteraction('ask', { question: 'Teste switch' });
      await handler.handle(asInteraction(ask));

      const list = new FakeDiscordInteraction('session', {}, 'list');
      await handler.handle(asInteraction(list));
      const match = list.getReply().match(/`([^`]+)`/);
      const sessionId = match![1];

      const sw = new FakeDiscordInteraction('session', { session_id: sessionId }, 'switch');
      await handler.handle(asInteraction(sw));

      expect(sw.getReply()).toContain('ativada');
    });
  });

  describe('/help', () => {
    it('lists all available commands', async () => {
      const llm = new FakeLlmService();
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction('help');

      await handler.handle(asInteraction(interaction));

      expect(interaction.isDeferred()).toBe(true);
      expect(interaction.getReply()).toContain('/ask');
      expect(interaction.getReply()).toContain('/equipment');
      expect(interaction.getReply()).toContain('/session');
    });
  });

  describe('deferReply contract', () => {
    it('always calls deferReply before editReply', async () => {
      const llm = new FakeLlmService().queueResponse('ok');
      const handler = makeCommandHandler(llm);

      let deferCalledFirst = false;
      let replyCalledWhileDeferred = false;

      const interaction = new FakeDiscordInteraction('ask', { question: 'Teste' });
      const origDefer = interaction.deferReply.bind(interaction);
      const origEdit = interaction.editReply.bind(interaction);

      interaction.deferReply = async () => {
        deferCalledFirst = true;
        return origDefer();
      };
      interaction.editReply = async (content: string) => {
        replyCalledWhileDeferred = deferCalledFirst;
        return origEdit(content);
      };

      await handler.handle(asInteraction(interaction));

      expect(deferCalledFirst).toBe(true);
      expect(replyCalledWhileDeferred).toBe(true);
    });
  });
});
