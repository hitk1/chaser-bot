import { FARMING_SYSTEM_PROMPT } from '../../constants/game-prompts';
import { ThrottleConfig } from '../check-throttle/check-throttle.use-case';
import { AskQuestionUseCase } from '../ask-question/ask-question.use-case';
import { AskQuestionOutput } from '../ask-question/ask-question.dto';

export interface GetFarmingStrategyInput {
  discordUserId: string;
  channelId: string;
  username: string;
  target: string;
  throttle: ThrottleConfig;
  sessionInactivityMinutes: number;
}

export class GetFarmingStrategyUseCase {
  constructor(private readonly askQuestion: AskQuestionUseCase) {}

  async execute(input: GetFarmingStrategyInput): Promise<AskQuestionOutput> {
    const question = `Qual a melhor estratégia para farmar "${input.target}"?`;

    return this.askQuestion.execute({
      discordUserId: input.discordUserId,
      channelId: input.channelId,
      username: input.username,
      question,
      systemPrompt: FARMING_SYSTEM_PROMPT,
      throttle: input.throttle,
      sessionInactivityMinutes: input.sessionInactivityMinutes,
    });
  }
}
