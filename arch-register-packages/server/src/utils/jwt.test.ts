import { describe, expect, it } from 'vitest';
import { parseExpiryToSeconds } from './jwt';

describe('parseExpiryToSeconds', () => {
  it('converts seconds', () => {
    expect(parseExpiryToSeconds('30s')).toBe(30);
    expect(parseExpiryToSeconds('1s')).toBe(1);
  });

  it('converts minutes', () => {
    expect(parseExpiryToSeconds('5m')).toBe(300);
    expect(parseExpiryToSeconds('1m')).toBe(60);
  });

  it('converts hours', () => {
    expect(parseExpiryToSeconds('1h')).toBe(3600);
    expect(parseExpiryToSeconds('2h')).toBe(7200);
  });

  it('converts days', () => {
    expect(parseExpiryToSeconds('7d')).toBe(604800);
    expect(parseExpiryToSeconds('1d')).toBe(86400);
  });

  it('falls back to 3600 for empty string', () => {
    expect(parseExpiryToSeconds('')).toBe(3600);
  });

  it('falls back to 3600 for invalid format (no unit)', () => {
    expect(parseExpiryToSeconds('3600')).toBe(3600);
  });

  it('falls back to 3600 for invalid format (unknown unit)', () => {
    expect(parseExpiryToSeconds('10w')).toBe(3600);
  });

  it('falls back to 3600 for non-numeric value', () => {
    expect(parseExpiryToSeconds('xh')).toBe(3600);
  });
});
