import { describe, expect, it } from 'vitest';
import { decodeDurationText, encodeDurationText } from './durationFormat';

describe('bulk duration text encoding', () => {
  it('round-trips amount and unit', () => {
    expect(encodeDurationText({ amount: 3, unit: 'months' })).toBe('3 months');
    expect(decodeDurationText('3 months')).toEqual({ amount: 3, unit: 'months' });
  });

  it('defaults the unit to years when encoding', () => {
    expect(encodeDurationText({ amount: 2 })).toBe('2 years');
  });

  it('encodes a missing amount as empty', () => {
    expect(encodeDurationText({ unit: 'days' })).toBe('');
  });

  it('decodes incomplete or invalid text to null', () => {
    expect(decodeDurationText('')).toBeNull();
    expect(decodeDurationText('3')).toBeNull();
    expect(decodeDurationText('3 fortnights')).toBeNull();
    expect(decodeDurationText('-1 days')).toBeNull();
  });
});
