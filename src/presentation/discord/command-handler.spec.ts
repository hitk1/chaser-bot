import { ChatInputCommandInteraction } from 'discord.js';
import { clearDatabase } from '../../test/db-helpers';
import { prisma } from '../../test/prisma';
import { FakeLlmService } from '../../test/fakes/fake-llm.service';
import { FakeWikiSearchService } from '../../test/fakes/fake-wiki-search.service';
import { FakeWebSearchService } from '../../test/fakes/fake-web-search.service';
import {
  makeRepositories,
  defaultThrottle,
  defaultSessionInactivityMinutes,
} from '../../test/use-case-factory';
import { CheckThrottleUseCase } from '../../application/use-cases/check-throttle/check-throttle.use-case';
import { ResolveActiveSessionUseCase } from '../../application/use-cases/resolve-active-session/resolve-active-session.use-case';
import { AskQuestionUseCase } from '../../application/use-cases/ask-question/ask-question.use-case';
import { SearchWikiUseCase } from '../../application/use-cases/search-wiki/search-wiki.use-case';
import { SearchWebUseCase } from '../../application/use-cases/search-web/search-web.use-case';
import { HandleReplyUseCase } from '../../application/use-cases/handle-reply/handle-reply.use-case';
import { CommandHandler, CommandConfig } from './command-handler';
import pino from 'pino';

// ---------------------------------------------------------------------------
// FakeDiscordInteraction — editReply returns { id } to satisfy Discord.js type
// ---------------------------------------------------------------------------

class FakeDiscordInteraction {
  commandName: string;
  user = { id: 'discord-test-user', username: 'Tester' };
  channelId = 'channel-test';

  private _reply = '';
  private _followUps: string[] = [];
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

  async editReply(content: string): Promise<{ id: string }> {
    this._reply = content;
    return { id: 'fake-discord-msg-id' };
  }

  async followUp(content: string): Promise<void> {
    this._followUps.push(content);
  }

  getReply(): string {
    return this._reply;
  }

  getFollowUps(): string[] {
    return this._followUps;
  }

  isDeferred(): boolean {
    return this._deferred;
  }
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

const nullLogger = pino({ level: 'silent' });

function makeCommandHandler(
  llmService: FakeLlmService,
  wikiSearch?: FakeWikiSearchService,
  webSearch?: FakeWebSearchService | null,
): CommandHandler {
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
  const searchWiki = new SearchWikiUseCase(
    wikiSearch ?? new FakeWikiSearchService(),
    askQuestion,
    nullLogger,
  );
  const searchWeb = new SearchWebUseCase(
    webSearch === undefined ? new FakeWebSearchService() : webSearch,
    askQuestion,
    nullLogger,
  );
  const handleReply = new HandleReplyUseCase(repos.sessionRepository, askQuestion, nullLogger);

  const commandConfig: CommandConfig = {
    throttle: defaultThrottle,
    sessionInactivityMinutes: defaultSessionInactivityMinutes,
  };

  return new CommandHandler(
    { searchWiki, searchWeb, handleReply, sessionRepository: repos.sessionRepository },
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

  afterAll(async () => {
    await prisma.$disconnect();
  });

  describe('/ask', () => {
    it('defers first, then puts LLM answer in editReply', async () => {
      const llm = new FakeLlmService().queueResponse('Resultados encontrados no Reddit.');
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction('ask', { question: 'Melhor build de Arme?' });

      await handler.handle(asInteraction(interaction));

      expect(interaction.isDeferred()).toBe(true);
      expect(interaction.getReply()).toBe('Resultados encontrados no Reddit.');
    });

    it('returns throttle warning when user is rate-limited', async () => {
      const llm = new FakeLlmService();
      for (let i = 0; i < defaultThrottle.maxRequests; i++) {
        llm.queueResponse(`Resposta ${i + 1}`);
      }
      const handler = makeCommandHandler(llm);

      for (let i = 0; i < defaultThrottle.maxRequests; i++) {
        const req = new FakeDiscordInteraction('ask', { question: `Pergunta ${i + 1}` });
        await handler.handle(asInteraction(req));
      }

      const throttled = new FakeDiscordInteraction('ask', { question: 'Pergunta extra' });
      await handler.handle(asInteraction(throttled));

      expect(throttled.getReply()).toContain('Tester');
    });

    it('injects web-search-results section into the system message', async () => {
      const llm = new FakeLlmService().queueResponse('Resultados da web');
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction('ask', { question: 'Meta atual?' });

      await handler.handle(asInteraction(interaction));

      const systemMsg = llm.lastMessages.find((m) => m.role === 'system');
      expect(systemMsg?.content).toContain('<web-search-results>');
    });

    it('appends Links Relacionados section when search returns results', async () => {
      const webSearch = new FakeWebSearchService().setResults([
        { title: 'Guia Arme Reddit', snippet: 'Dicas de build', url: 'https://reddit.com/r/Grandchase/1' },
        { title: 'Arme Wiki', snippet: 'Informações da wiki', url: 'https://grandchase.fandom.com/arme' },
      ]);
      const llm = new FakeLlmService().queueResponse('Resposta sobre Arme.');
      const handler = makeCommandHandler(llm, undefined, webSearch);
      const interaction = new FakeDiscordInteraction('ask', { question: 'Build Arme?' });

      await handler.handle(asInteraction(interaction));

      expect(interaction.getReply()).toContain('## Links Relacionados');
      expect(interaction.getReply()).toContain('https://reddit.com/r/Grandchase/1');
      expect(interaction.getReply()).toContain('https://grandchase.fandom.com/arme');
    });
  });

  describe('/wiki', () => {
    it('defers first, then puts wiki LLM answer in editReply', async () => {
      const llm = new FakeLlmService().queueResponse('Elesis é uma guerreira da classe Knight.');
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction('wiki', { question: 'Quem é a Elesis?' });

      await handler.handle(asInteraction(interaction));

      expect(interaction.isDeferred()).toBe(true);
      expect(interaction.getReply()).toBe('Elesis é uma guerreira da classe Knight.');
    });

    it('returns throttle warning when user is rate-limited on /wiki', async () => {
      const llm = new FakeLlmService();
      for (let i = 0; i < defaultThrottle.maxRequests; i++) {
        llm.queueResponse(`Resposta wiki ${i + 1}`);
      }
      const handler = makeCommandHandler(llm);

      for (let i = 0; i < defaultThrottle.maxRequests; i++) {
        const req = new FakeDiscordInteraction('wiki', { question: `Pergunta ${i + 1}` });
        await handler.handle(asInteraction(req));
      }

      const throttled = new FakeDiscordInteraction('wiki', { question: 'Mais uma' });
      await handler.handle(asInteraction(throttled));

      expect(throttled.getReply()).toContain('Tester');
    });

    it('injects wiki-results section into the system message', async () => {
      const llm = new FakeLlmService().queueResponse('Info da wiki');
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction('wiki', { question: 'Quem é a Lire?' });

      await handler.handle(asInteraction(interaction));

      const systemMsg = llm.lastMessages.find((m) => m.role === 'system');
      expect(systemMsg?.content).toContain('<wiki-results>');
    });
  });

  describe('/help', () => {
    it('lists only active commands', async () => {
      const llm = new FakeLlmService();
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction('help');

      await handler.handle(asInteraction(interaction));

      expect(interaction.isDeferred()).toBe(true);
      expect(interaction.getReply()).toContain('/ask');
      expect(interaction.getReply()).toContain('/wiki');
      expect(interaction.getReply()).toContain('/help');
      expect(interaction.getReply()).not.toContain('/equipment');
      expect(interaction.getReply()).not.toContain('/farming');
      expect(interaction.getReply()).not.toContain('/session');
    });
  });

  describe('long message chunking', () => {
    it('sends first 2000 chars via editReply and remainder via followUp', async () => {
      const longAnswer = 'A'.repeat(1500) + '\n' + 'B'.repeat(1500);
      const llm = new FakeLlmService().queueResponse(longAnswer);
      const handler = makeCommandHandler(llm);
      const interaction = new FakeDiscordInteraction('ask', { question: 'Explique tudo' });

      await handler.handle(asInteraction(interaction));

      expect(interaction.getReply().length).toBeLessThanOrEqual(2000);
      expect(interaction.getFollowUps().length).toBeGreaterThan(0);
      const combined = interaction.getReply() + interaction.getFollowUps().join('');
      expect(combined).toContain('A'.repeat(100));
      expect(combined).toContain('B'.repeat(100));
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
