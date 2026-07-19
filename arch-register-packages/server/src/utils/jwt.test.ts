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

  it('rejects an empty string', () => {
    expect(() => parseExpiryToSeconds('')).toThrow('Invalid JWT expiry');
  });

  it('rejects invalid format (no unit)', () => {
    expect(() => parseExpiryToSeconds('3600')).toThrow('Invalid JWT expiry');
  });

  it('rejects invalid format (unknown unit)', () => {
    expect(() => parseExpiryToSeconds('10w')).toThrow('Invalid JWT expiry');
  });

  it('rejects non-numeric values', () => {
    expect(() => parseExpiryToSeconds('xh')).toThrow('Invalid JWT expiry');
  });

  it('rejects zero duration', () => {
    expect(() => parseExpiryToSeconds('0s')).toThrow('greater than zero');
  });
});
