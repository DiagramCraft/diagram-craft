const WEBHOOK_RETRY_DELAYS_MS = [60_000, 5 * 60_000, 30 * 60_000, 2 * 60 * 60_000];

export class RetryableJobError extends Error {
  constructor(
    message: string,
    readonly retryAfterMs?: number
  ) {
    super(message);
    this.name = 'RetryableJobError';
  }
}

export const retryDelayMs = (attemptCount: number, requestedDelay?: number) => {
  if (requestedDelay != null) {
    return Math.min(2 * 60 * 60_000, Math.max(1_000, requestedDelay));
  }
  return WEBHOOK_RETRY_DELAYS_MS[Math.max(0, attemptCount - 1)] ?? 2 * 60 * 60_000;
};
