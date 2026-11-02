export const formatThrottledLoginMessage = (retryAfterSeconds: number | null): string => {
  if (retryAfterSeconds == null || !Number.isFinite(retryAfterSeconds) || retryAfterSeconds <= 0) {
    return 'Too many login attempts. Please try again later.';
  }
  if (retryAfterSeconds < 60) {
    return `Too many login attempts. Try again in ${Math.ceil(retryAfterSeconds)} seconds.`;
  }
  const minutes = Math.ceil(retryAfterSeconds / 60);
  return `Too many login attempts. Try again in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}.`;
};
