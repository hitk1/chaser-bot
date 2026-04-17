import { EQUIPMENT_SYSTEM_PROMPT } from '../../constants/game-prompts';
import { ThrottleConfig } from '../check-throttle/check-throttle.use-case';
import { AskQuestionUseCase } from '../ask-question/ask-question.use-case';
import { AskQuestionOutput } from '../ask-question/ask-question.dto';

export interface GetEquipmentAdviceInput {
  discordUserId: string;
  channelId: string;
  username: string;
  character: string;
  slot: string;
  throttle: ThrottleConfig;
  sessionInactivityMinutes: number;
}

export class GetEquipmentAdviceUseCase {
  constructor(private readonly askQuestion: AskQuestionUseCase) {}

  async execute(input: GetEquipmentAdviceInput): Promise<AskQuestionOutput> {
    const question = `Qual o melhor setup de cartas para ${input.character} no slot "${input.slot}"?`;

    return this.askQuestion.execute({
      discordUserId: input.discordUserId,
      channelId: input.channelId,
      username: input.username,
      question,
      systemPrompt: EQUIPMENT_SYSTEM_PROMPT,
      throttle: input.throttle,
      sessionInactivityMinutes: input.sessionInactivityMinutes,
    });
  }
}
