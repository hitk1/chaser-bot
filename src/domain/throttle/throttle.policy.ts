export interface ThrottleResult {
  allowed: boolean;
  warningMessage?: string;
}

export class ThrottlePolicy {
  static evaluate(
    timestamps: number[],
    maxRequests: number,
    windowSeconds: number,
    warningMessageTemplate: string,
    username: string,
  ): ThrottleResult {
    const active = ThrottlePolicy.slideWindow(timestamps, windowSeconds);

    if (active.length >= maxRequests) {
      return {
        allowed: false,
        warningMessage: warningMessageTemplate.replace('{username}', username),
      };
    }

    return { allowed: true };
  }

  static slideWindow(timestamps: number[], windowSeconds: number): number[] {
    const windowMs = windowSeconds * 1000;
    const now = Date.now();
    return timestamps.filter((t) => now - t < windowMs);
  }
}
