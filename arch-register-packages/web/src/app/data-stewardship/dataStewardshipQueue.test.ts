import { describe, expect, it } from 'vitest';
import type { GovernanceCase } from '@arch-register/api-types/governanceContract';
import { isCaseOverdue, queueItemPriority } from './dataStewardshipQueue';

const governanceCase = (overrides: Partial<GovernanceCase> = {}): GovernanceCase => ({
  id: 'case-1',
  workspace: 'ws-1',
  caseKind: 'field-date-reminder',
  subjectType: 'entity',
  subjectId: 'entity-1',
  subjectVersion: null,
  status: 'open',
  outcome: null,
  policyVersion: null,
  initiatorUserId: null,
  parentCaseId: null,
  selfApprovalAllowed: false,
  payload: {},
  initiationFields: [],
  createdAt: '2026-01-01T00:00:00.000Z',
  dueAt: null,
  completedAt: null,
  cancelledAt: null,
  escalatedAt: null,
  ...overrides
});

describe('isCaseOverdue', () => {
  const now = new Date('2026-09-17T00:00:00.000Z');

  it('is overdue once dueAt is in the past', () => {
    expect(isCaseOverdue(governanceCase({ dueAt: '2026-09-01T00:00:00.000Z' }), now)).toBe(true);
  });

  it('is not overdue with no due date, or a future due date', () => {
    expect(isCaseOverdue(governanceCase({ dueAt: null }), now)).toBe(false);
    expect(isCaseOverdue(governanceCase({ dueAt: '2099-01-01T00:00:00.000Z' }), now)).toBe(false);
  });
});

describe('queueItemPriority', () => {
  const now = new Date('2026-09-17T00:00:00.000Z');

  it('is high once escalated, regardless of due date', () => {
    expect(
      queueItemPriority(governanceCase({ escalatedAt: '2026-09-01T00:00:00.000Z' }), now)
    ).toBe('high');
  });

  it('is high once overdue', () => {
    expect(queueItemPriority(governanceCase({ dueAt: '2026-09-01T00:00:00.000Z' }), now)).toBe(
      'high'
    );
  });

  it('is medium when due within 7 days', () => {
    expect(queueItemPriority(governanceCase({ dueAt: '2026-09-20T00:00:00.000Z' }), now)).toBe(
      'medium'
    );
  });

  it('is low when due further out, or with no due date at all', () => {
    expect(queueItemPriority(governanceCase({ dueAt: '2026-10-20T00:00:00.000Z' }), now)).toBe(
      'low'
    );
    expect(queueItemPriority(governanceCase({ dueAt: null }), now)).toBe('low');
  });
});
