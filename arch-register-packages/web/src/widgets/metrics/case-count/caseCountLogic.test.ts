import { describe, expect, it } from 'vitest';
import { countDueWithin, renderCaseCountSubtext } from './caseCountLogic';

describe('countDueWithin', () => {
  const now = new Date('2026-01-10T00:00:00Z');

  it('counts overdue and upcoming cases within the window, ignoring undated and later ones', () => {
    const cases = [
      { dueAt: '2026-01-01T00:00:00Z' },
      { dueAt: '2026-01-15T00:00:00Z' },
      { dueAt: '2026-02-15T00:00:00Z' },
      { dueAt: null }
    ];
    expect(countDueWithin(cases, 7, now)).toBe(2);
  });
});

describe('renderCaseCountSubtext', () => {
  it('replaces {count} and {due}', () => {
    expect(renderCaseCountSubtext('{due} of {count} due', 5, 2)).toBe('2 of 5 due');
  });
});
