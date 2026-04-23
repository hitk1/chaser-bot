import { ThrottleConfig } from '../check-throttle/check-throttle.use-case';

export interface AskQuestionInput {
  discordUserId: string;
  channelId: string;
  username: string;
  question: string;
  systemPrompt: string;
  throttle: ThrottleConfig;
  sessionInactivityMinutes: number;
  forceNewSession?: boolean;
  existingSessionId?: string;
}

export interface AskQuestionOutput {
  answer: string;
  sessionId: string;
  warningMessage?: string;
}
