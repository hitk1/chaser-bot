export interface RateLimitEntry {
  id: string;
  userId: string;
  requestTimestamps: number[];
  updatedAt: Date;
}
