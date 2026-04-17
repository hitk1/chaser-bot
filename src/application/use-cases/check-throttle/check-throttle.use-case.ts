import { ThrottlePolicy, ThrottleResult } from '../../../domain/throttle/throttle.policy';
import { IThrottleRepository } from '../../../domain/throttle/throttle.repository';

export interface ThrottleConfig {
  maxRequests: number;
  windowSeconds: number;
  warningMessageTemplate: string;
}

export interface CheckThrottleInput {
  userId: string;
  username: string;
  config: ThrottleConfig;
}

export class CheckThrottleUseCase {
  constructor(private readonly throttleRepository: IThrottleRepository) {}

  async execute(input: CheckThrottleInput): Promise<ThrottleResult> {
    const { userId, username, config } = input;

    const existingEntry = await this.throttleRepository.findByUserId(userId);
    const currentTimestamps = existingEntry?.requestTimestamps ?? [];

    const result = ThrottlePolicy.evaluate(
      currentTimestamps,
      config.maxRequests,
      config.windowSeconds,
      config.warningMessageTemplate,
      username,
    );

    if (result.allowed) {
      const updatedTimestamps = [
        ...ThrottlePolicy.slideWindow(currentTimestamps, config.windowSeconds),
        Date.now(),
      ];
      await this.throttleRepository.upsert({
        id: existingEntry?.id ?? '',
        userId,
        requestTimestamps: updatedTimestamps,
        updatedAt: new Date(),
      });
    }

    return result;
  }
}
