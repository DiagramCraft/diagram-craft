import { describe, expect, it } from 'vitest';
import { computeNextOccurrenceAt, validateAssessmentRecurrence } from './assessmentRecurrence';

describe('validateAssessmentRecurrence', () => {
  it('accepts a none recurrence', () => {
    expect(() => validateAssessmentRecurrence({ type: 'none' })).not.toThrow();
  });

  it('rejects a non-positive weekly interval', () => {
    expect(() => validateAssessmentRecurrence({ type: 'weekly', intervalWeeks: 0 })).toThrow(
      /positive integer/
    );
  });

  it('rejects a non-positive monthly interval', () => {
    expect(() => validateAssessmentRecurrence({ type: 'monthly', intervalMonths: -1 })).toThrow(
      /positive integer/
    );
  });
});

describe('computeNextOccurrenceAt', () => {
  const from = new Date('2026-01-01T00:00:00.000Z');

  it('throws for a none recurrence', () => {
    expect(() => computeNextOccurrenceAt({ type: 'none' }, from)).toThrow();
  });

  it('adds N weeks for a weekly recurrence', () => {
    const next = computeNextOccurrenceAt({ type: 'weekly', intervalWeeks: 2 }, from);
    expect(next.toISOString()).toBe('2026-01-15T00:00:00.000Z');
  });

  it('adds N months for a monthly recurrence (quarterly = intervalMonths: 3)', () => {
    const next = computeNextOccurrenceAt({ type: 'monthly', intervalMonths: 3 }, from);
    expect(next.toISOString()).toBe('2026-04-01T00:00:00.000Z');
  });
});
