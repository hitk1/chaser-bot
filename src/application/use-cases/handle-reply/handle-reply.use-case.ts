import { Logger } from 'pino';
import { ISessionRepository } from '../../../domain/session/session.repository';
import { BASE_GRANDCHASE_SYSTEM_PROMPT } from '../../constants/game-prompts';
import { AskQuestionUseCase } from '../ask-question/ask-question.use-case';
import { HandleReplyInput, HandleReplyOutput } from './handle-reply.dto';

const NOT_FOUND_MESSAGE =
  'Não encontrei a conversa original. Use /ask para iniciar uma nova pergunta.';

export class HandleReplyUseCase {
  constructor(
    private readonly sessionRepository: ISessionRepository,
    private readonly askQuestion: AskQuestionUseCase,
    private readonly logger: Logger,
  ) {}

  async execute(input: HandleReplyInput): Promise<HandleReplyOutput> {
    const { discordUserId, username, channelId, question, repliedToMessageId, throttle, sessionInactivityMinutes } =
      input;

    this.logger.info(
      { discordUserId, username, channelId, repliedToMessageId },
      '[HANDLE-REPLY][USE-CASE] Processing reply',
    );

    const session = await this.sessionRepository.findByDiscordMessageId(repliedToMessageId);

    if (!session) {
      this.logger.warn(
        { discordUserId, repliedToMessageId },
        '[HANDLE-REPLY][USE-CASE] No session found for replied message',
      );
      return { answer: NOT_FOUND_MESSAGE, sessionId: '' };
    }

    this.logger.info(
      { discordUserId, repliedToMessageId, sessionId: session.id },
      '[HANDLE-REPLY][USE-CASE] Session found, continuing conversation',
    );

    return this.askQuestion.execute({
      discordUserId,
      username,
      channelId,
      question,
      systemPrompt: BASE_GRANDCHASE_SYSTEM_PROMPT,
      throttle,
      sessionInactivityMinutes,
      existingSessionId: session.id,
    });
  }
}
