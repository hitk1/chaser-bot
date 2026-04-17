import { RateLimitEntry } from './throttle.entity';

export interface IThrottleRepository {
  findByUserId(userId: string): Promise<RateLimitEntry | null>;
  upsert(entry: RateLimitEntry): Promise<void>;
}
