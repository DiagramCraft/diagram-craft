import { describe, expect, it } from 'vitest';
import { formatThrottledLoginMessage } from './loginThrottleMessage';

describe('formatThrottledLoginMessage', () => {
  it('falls back to a generic message without a usable retry time', () => {
    expect(formatThrottledLoginMessage(null)).toBe(
      'Too many login attempts. Please try again later.'
    );
    expect(formatThrottledLoginMessage(0)).toContain('later');
  });

  it('reports seconds under a minute', () => {
    expect(formatThrottledLoginMessage(30)).toBe(
      'Too many login attempts. Try again in 30 seconds.'
    );
  });

  it('rounds up to whole minutes', () => {
    expect(formatThrottledLoginMessage(60)).toBe('Too many login attempts. Try again in 1 minute.');
    expect(formatThrottledLoginMessage(61)).toBe(
      'Too many login attempts. Try again in 2 minutes.'
    );
  });
});
