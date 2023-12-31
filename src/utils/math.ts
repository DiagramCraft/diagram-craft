/**
 * Round a number to 2 decimal places (for display purposes)
 */
export const round = (n: number) => {
  const res = Math.round(n * 100) / 100;
  // To ensure -0 === 0
  if (res === 0) return 0;
  return res;
};

/**
 * Returns a number whose value is limited to the given range.
 */
export const clamp = (n: number, min: number, max: number) => {
  return Math.max(min, Math.min(max, n));
};
