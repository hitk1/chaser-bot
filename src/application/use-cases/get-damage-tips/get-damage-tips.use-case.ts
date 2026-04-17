import { DAMAGE_SYSTEM_PROMPT } from '../../constants/game-prompts';
import { ThrottleConfig } from '../check-throttle/check-throttle.use-case';
import { AskQuestionUseCase } from '../ask-question/ask-question.use-case';
import { AskQuestionOutput } from '../ask-question/ask-question.dto';

export interface GetDamageTipsInput {
  discordUserId: string;
  channelId: string;
  username: string;
  character: string;
  throttle: ThrottleConfig;
  sessionInactivityMinutes: number;
}

export class GetDamageTipsUseCase {
  constructor(private readonly askQuestion: AskQuestionUseCase) {}

  async execute(input: GetDamageTipsInput): Promise<AskQuestionOutput> {
    const question = `Como maximizar o dano de ${input.character}? Quais habilidades, builds e combos devo usar?`;

    return this.askQuestion.execute({
      discordUserId: input.discordUserId,
      channelId: input.channelId,
      username: input.username,
      question,
      systemPrompt: DAMAGE_SYSTEM_PROMPT,
      throttle: input.throttle,
      sessionInactivityMinutes: input.sessionInactivityMinutes,
    });
  }
}
