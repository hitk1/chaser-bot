import { Session, SessionProps } from './session.entity';

function makeSession(overrides: Partial<SessionProps> = {}): Session {
  return new Session({
    id: 'session-1',
    userId: 'user-1',
    channelId: 'channel-1',
    title: null,
    createdAt: new Date(),
    lastActiveAt: new Date(),
    messages: [],
    ...overrides,
  });
}

describe('Session entity', () => {
  describe('isActive', () => {
    it('returns true when last activity is within the inactivity window', () => {
      const session = makeSession({ lastActiveAt: new Date(Date.now() - 3 * 60 * 1000) });
      expect(session.isActive(10)).toBe(true);
    });

    it('returns false when last activity exceeds the inactivity window', () => {
      const session = makeSession({ lastActiveAt: new Date(Date.now() - 11 * 60 * 1000) });
      expect(session.isActive(10)).toBe(false);
    });

    it('returns false when last activity equals exactly the inactivity window', () => {
      const session = makeSession({ lastActiveAt: new Date(Date.now() - 10 * 60 * 1000) });
      expect(session.isActive(10)).toBe(false);
    });
  });

  describe('addMessage', () => {
    it('appends the message to the messages array', () => {
      const session = makeSession();
      session.addMessage('user', 'qual o melhor set para mago?');
      expect(session.messages).toHaveLength(1);
      expect(session.messages[0].role).toBe('user');
      expect(session.messages[0].content).toBe('qual o melhor set para mago?');
    });

    it('sets sessionId on the new message', () => {
      const session = makeSession({ id: 'session-abc' });
      session.addMessage('user', 'hello');
      expect(session.messages[0].sessionId).toBe('session-abc');
    });

    it('updates lastActiveAt after adding a message', () => {
      const before = new Date(Date.now() - 5000);
      const session = makeSession({ lastActiveAt: before });
      session.addMessage('user', 'hello');
      expect(session.lastActiveAt.getTime()).toBeGreaterThan(before.getTime());
    });

    it('auto-generates the title from the first user message', () => {
      const session = makeSession({ title: null });
      session.addMessage('user', 'qual o melhor set para mago?');
      expect(session.title).toBe('qual o melhor set para mago?');
    });

    it('truncates the title to 40 characters', () => {
      const session = makeSession({ title: null });
      session.addMessage('user', 'a'.repeat(60));
      expect(session.title).toHaveLength(40);
    });

    it('does not override an existing title', () => {
      const session = makeSession({ title: 'título existente' });
      session.addMessage('user', 'nova mensagem');
      expect(session.title).toBe('título existente');
    });

    it('does not set title for non-user roles', () => {
      const session = makeSession({ title: null });
      session.addMessage('system', 'você é um assistente do GrandChase');
      expect(session.title).toBeNull();
    });

    it('stores the toolName when provided', () => {
      const session = makeSession();
      session.addMessage('tool', 'resultado da busca', 'web_search');
      expect(session.messages[0].toolName).toBe('web_search');
    });

    it('allows adding multiple messages in sequence', () => {
      const session = makeSession();
      session.addMessage('user', 'pergunta 1');
      session.addMessage('assistant', 'resposta 1');
      session.addMessage('user', 'pergunta 2');
      expect(session.messages).toHaveLength(3);
    });
  });

  describe('toPromptMessages', () => {
    it('returns empty array when there are no messages', () => {
      const session = makeSession();
      expect(session.toPromptMessages()).toEqual([]);
    });

    it('maps messages to role + content format', () => {
      const session = makeSession();
      session.addMessage('user', 'oi');
      session.addMessage('assistant', 'olá!');
      const prompts = session.toPromptMessages();
      expect(prompts).toEqual([
        { role: 'user', content: 'oi' },
        { role: 'assistant', content: 'olá!' },
      ]);
    });

    it('preserves message order', () => {
      const session = makeSession();
      session.addMessage('system', 'contexto');
      session.addMessage('user', 'pergunta');
      session.addMessage('assistant', 'resposta');
      const roles = session.toPromptMessages().map((m) => m.role);
      expect(roles).toEqual(['system', 'user', 'assistant']);
    });
  });
});
