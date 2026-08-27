import { describe, expect, it } from 'vitest';
import { isNowDateLiteral } from '@arch-register/api-types/nowDateLiteral';

describe('isNowDateLiteral', () => {
  it('accepts the bare marker', () => {
    expect(isNowDateLiteral({ $now: true })).toBe(true);
  });

  it('accepts a positive integer offset', () => {
    expect(isNowDateLiteral({ $now: true, offsetDays: 30 })).toBe(true);
  });

  it('accepts a negative integer offset', () => {
    expect(isNowDateLiteral({ $now: true, offsetDays: -7 })).toBe(true);
  });

  it('rejects $now: false', () => {
    expect(isNowDateLiteral({ $now: false })).toBe(false);
  });

  it('rejects a non-integer offsetDays', () => {
    expect(isNowDateLiteral({ $now: true, offsetDays: 1.5 })).toBe(false);
  });

  it('rejects a non-numeric offsetDays', () => {
    expect(isNowDateLiteral({ $now: true, offsetDays: 'x' })).toBe(false);
  });

  it('rejects plain strings', () => {
    expect(isNowDateLiteral('2026-01-01')).toBe(false);
  });

  it('rejects null', () => {
    expect(isNowDateLiteral(null)).toBe(false);
  });

  it('rejects arrays', () => {
    expect(isNowDateLiteral([])).toBe(false);
  });

  it('rejects undefined', () => {
    expect(isNowDateLiteral(undefined)).toBe(false);
  });
});
