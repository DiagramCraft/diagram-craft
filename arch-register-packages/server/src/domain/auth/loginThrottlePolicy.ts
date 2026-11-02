export type LoginThrottlePolicy = {
  /** Consecutive failures for one account before it is locked */
  maxFailures: number;
  lockoutBaseSeconds: number;
  lockoutMaxSeconds: number;
  /** Failures older than this (and not covered by a lock) no longer count */
  failureWindowSeconds: number;
  /** Failed attempts from one IP within the IP window before it is blocked */
  ipMaxAttempts: number;
  ipWindowSeconds: number;
};

const readPositiveInt = (name: string, fallback: number) => {
  const raw = process.env[name];
  if (raw == null || raw.trim() === '') return fallback;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

export const getLoginThrottlePolicy = (): LoginThrottlePolicy => ({
  maxFailures: readPositiveInt('LOGIN_MAX_FAILURES', 5),
  lockoutBaseSeconds: readPositiveInt('LOGIN_LOCKOUT_BASE_SECONDS', 60),
  lockoutMaxSeconds: readPositiveInt('LOGIN_LOCKOUT_MAX_SECONDS', 3600),
  failureWindowSeconds: readPositiveInt('LOGIN_FAILURE_WINDOW_SECONDS', 900),
  ipMaxAttempts: readPositiveInt('LOGIN_IP_MAX_ATTEMPTS', 20),
  ipWindowSeconds: readPositiveInt('LOGIN_IP_WINDOW_SECONDS', 300)
});

/**
 * Lock duration once `failureCount` consecutive failures have occurred.
 * Returns 0 while below the threshold; doubles for each failure beyond it, capped.
 */
export const computeLockSeconds = (failureCount: number, policy: LoginThrottlePolicy): number => {
  if (failureCount < policy.maxFailures) return 0;
  const exponent = Math.min(failureCount - policy.maxFailures, 30);
  return Math.min(policy.lockoutBaseSeconds * 2 ** exponent, policy.lockoutMaxSeconds);
};

export const normalizeThrottleUsername = (username: string) => username.trim().toLowerCase();
