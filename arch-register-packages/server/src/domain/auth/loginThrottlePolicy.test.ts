import { describe, expect, it } from 'vitest';
import { computeLockSeconds, type LoginThrottlePolicy } from './loginThrottlePolicy';

const policy: LoginThrottlePolicy = {
  maxFailures: 5,
  lockoutBaseSeconds: 60,
  lockoutMaxSeconds: 3600,
  failureWindowSeconds: 900,
  ipMaxAttempts: 20,
  ipWindowSeconds: 300
};

describe('computeLockSeconds', () => {
  it('does not lock below the threshold', () => {
    expect(computeLockSeconds(4, policy)).toBe(0);
  });

  it('locks for the base duration at the threshold and doubles afterwards', () => {
    expect(computeLockSeconds(5, policy)).toBe(60);
    expect(computeLockSeconds(6, policy)).toBe(120);
    expect(computeLockSeconds(7, policy)).toBe(240);
  });

  it('caps at the maximum', () => {
    expect(computeLockSeconds(40, policy)).toBe(3600);
  });
});
