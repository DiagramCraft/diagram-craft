export const parseExpiryToSeconds = (expiry: string): number => {
  const match = expiry.match(/^(\d+)(s|m|h|d)$/);
  if (!match?.[1] || !match[2]) {
    throw new Error(`Invalid JWT expiry '${expiry}'; expected a value such as 15m, 1h, or 7d`);
  }
  const value = parseInt(match[1], 10);
  if (value <= 0) {
    throw new Error(`Invalid JWT expiry '${expiry}'; duration must be greater than zero`);
  }
  const unit = match[2];
  switch (unit) {
    case 's':
      return value;
    case 'm':
      return value * 60;
    case 'h':
      return value * 3600;
    case 'd':
      return value * 86400;
    default:
      throw new Error(`Invalid JWT expiry '${expiry}'`);
  }
};
