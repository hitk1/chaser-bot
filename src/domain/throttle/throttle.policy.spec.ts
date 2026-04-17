import { ThrottlePolicy } from './throttle.policy';

const WARNING_TEMPLATE = 'Hey {username}, calma aí!';
const MAX_REQUESTS = 5;
const WINDOW_SECONDS = 60;

function recentTimestamp(offsetMs = 0): number {
  return Date.now() - offsetMs;
}

function expiredTimestamp(): number {
  return Date.now() - WINDOW_SECONDS * 1000 - 1;
}

describe('ThrottlePolicy', () => {
  describe('evaluate', () => {
    it('allows the request when there are no previous timestamps', () => {
      const result = ThrottlePolicy.evaluate([], MAX_REQUESTS, WINDOW_SECONDS, WARNING_TEMPLATE, 'Luís');
      expect(result.allowed).toBe(true);
      expect(result.warningMessage).toBeUndefined();
    });

    it('allows the request when under the limit', () => {
      const timestamps = [recentTimestamp(5000), recentTimestamp(10000)];
      const result = ThrottlePolicy.evaluate(timestamps, MAX_REQUESTS, WINDOW_SECONDS, WARNING_TEMPLATE, 'Luís');
      expect(result.allowed).toBe(true);
    });

    it('blocks the request when exactly at the limit', () => {
      const timestamps = Array.from({ length: MAX_REQUESTS }, (_, i) => recentTimestamp(i * 1000));
      const result = ThrottlePolicy.evaluate(timestamps, MAX_REQUESTS, WINDOW_SECONDS, WARNING_TEMPLATE, 'Luís');
      expect(result.allowed).toBe(false);
    });

    it('blocks the request when over the limit', () => {
      const timestamps = Array.from({ length: MAX_REQUESTS + 2 }, (_, i) => recentTimestamp(i * 1000));
      const result = ThrottlePolicy.evaluate(timestamps, MAX_REQUESTS, WINDOW_SECONDS, WARNING_TEMPLATE, 'Luís');
      expect(result.allowed).toBe(false);
    });

    it('interpolates the username in the warning message', () => {
      const timestamps = Array.from({ length: MAX_REQUESTS }, () => recentTimestamp());
      const result = ThrottlePolicy.evaluate(timestamps, MAX_REQUESTS, WINDOW_SECONDS, WARNING_TEMPLATE, 'Luís');
      expect(result.warningMessage).toBe('Hey Luís, calma aí!');
    });

    it('ignores expired timestamps outside the window', () => {
      const timestamps = [
        expiredTimestamp(),
        expiredTimestamp(),
        expiredTimestamp(),
        expiredTimestamp(),
        expiredTimestamp(),
      ];
      const result = ThrottlePolicy.evaluate(timestamps, MAX_REQUESTS, WINDOW_SECONDS, WARNING_TEMPLATE, 'Luís');
      expect(result.allowed).toBe(true);
    });

    it('counts only active timestamps within the window', () => {
      const timestamps = [
        expiredTimestamp(),
        expiredTimestamp(),
        recentTimestamp(5000),
        recentTimestamp(10000),
      ];
      const result = ThrottlePolicy.evaluate(timestamps, MAX_REQUESTS, WINDOW_SECONDS, WARNING_TEMPLATE, 'Luís');
      expect(result.allowed).toBe(true);
    });
  });

  describe('slideWindow', () => {
    it('returns only timestamps within the window', () => {
      const timestamps = [
        expiredTimestamp(),
        recentTimestamp(5000),
        recentTimestamp(10000),
        expiredTimestamp(),
      ];
      const result = ThrottlePolicy.slideWindow(timestamps, WINDOW_SECONDS);
      expect(result).toHaveLength(2);
    });

    it('returns empty array when all timestamps are expired', () => {
      const timestamps = [expiredTimestamp(), expiredTimestamp()];
      const result = ThrottlePolicy.slideWindow(timestamps, WINDOW_SECONDS);
      expect(result).toHaveLength(0);
    });

    it('returns all timestamps when all are recent', () => {
      const timestamps = [recentTimestamp(1000), recentTimestamp(2000)];
      const result = ThrottlePolicy.slideWindow(timestamps, WINDOW_SECONDS);
      expect(result).toHaveLength(2);
    });
  });
});
