import { ThrottleConfig } from '../check-throttle/check-throttle.use-case';
import { AskQuestionOutput } from '../ask-question/ask-question.dto';

export interface HandleReplyInput {
  discordUserId: string;
  username: string;
  channelId: string;
  question: string;
  repliedToMessageId: string;
  throttle: ThrottleConfig;
  sessionInactivityMinutes: number;
}

export type HandleReplyOutput = AskQuestionOutput;
