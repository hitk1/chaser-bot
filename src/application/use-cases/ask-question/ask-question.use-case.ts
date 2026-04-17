import { ILlmService, LlmMessage } from '../../ports/llm.port';
import { ISessionRepository } from '../../../domain/session/session.repository';
import { CheckThrottleUseCase } from '../check-throttle/check-throttle.use-case';
import { ResolveActiveSessionUseCase } from '../resolve-active-session/resolve-active-session.use-case';
import { AskQuestionInput, AskQuestionOutput } from './ask-question.dto';

export class AskQuestionUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly resolveActiveSession: ResolveActiveSessionUseCase,
    private readonly checkThrottle: CheckThrottleUseCase,
    private readonly llmService: ILlmService,
  ) {}

  async execute(input: AskQuestionInput): Promise<AskQuestionOutput> {
    const { discordUserId, channelId, username, question, systemPrompt, throttle, sessionInactivityMinutes } =
      input;

    const { session, user } = await this.resolveActiveSession.execute({
      discordUserId,
      channelId,
      sessionInactivityMinutes,
    });

    const throttleResult = await this.checkThrottle.execute({
      userId: user.id,
      username,
      config: throttle,
    });

    if (!throttleResult.allowed) {
      return {
        answer: '',
        sessionId: session.id,
        warningMessage: throttleResult.warningMessage,
      };
    }

    const systemMessage: LlmMessage = { role: 'system', content: systemPrompt };
    const historyMessages = session.toPromptMessages();
    const userMessage: LlmMessage = { role: 'user', content: question };

    const answer = await this.llmService.chat([systemMessage, ...historyMessages, userMessage]);

    session.addMessage('user', question);
    session.addMessage('assistant', answer);

    await this.sessionRepository.appendMessage(session.id, 'user', question);
    await this.sessionRepository.appendMessage(session.id, 'assistant', answer);
    await this.sessionRepository.update(session);

    return { answer, sessionId: session.id };
  }
}
