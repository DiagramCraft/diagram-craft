import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { GovernanceCaseDbResult } from './db/governanceDatabase';
import type { GovernanceCaseConfigDbResult } from './db/governanceCaseConfigDatabase';
import { createGovernanceRegistry, type GovernanceRegistry } from './governanceRegistry';
import type { GovernanceAssignmentTarget } from './governanceOperations';
import {
  computeCandidateReminderWindows,
  createGovernanceDeadlineScanJobHandler
} from './governanceDeadlineScanJob';

vi.mock('./governanceNotifications', () => ({
  createGovernanceInAppNotifications: vi.fn(async () => {})
}));

const now = new Date('2026-07-27T12:00:00.000Z');
const dayMs = 24 * 60 * 60 * 1000;

describe('computeCandidateReminderWindows', () => {
  it('does not fire an approaching window before it is reached', () => {
    const dueAt = new Date(now.getTime() + 10 * dayMs);
    const result = computeCandidateReminderWindows(
      dueAt,
      now,
      { approachingDays: [2], overdueDays: [1] },
      []
    );
    expect(result).toEqual([]);
  });

  it('fires an approaching window once due_at is within range', () => {
    const dueAt = new Date(now.getTime() + 2 * dayMs);
    const result = computeCandidateReminderWindows(
      dueAt,
      now,
      { approachingDays: [2], overdueDays: [1] },
      []
    );
    expect(result).toEqual(['approaching:2']);
  });

  it('does not re-fire a window already recorded as sent', () => {
    const dueAt = new Date(now.getTime() + 2 * dayMs);
    const result = computeCandidateReminderWindows(
      dueAt,
      now,
      { approachingDays: [2], overdueDays: [1] },
      ['approaching:2']
    );
    expect(result).toEqual([]);
  });

  it('fires an overdue window once past due_at by that many days', () => {
    const dueAt = new Date(now.getTime() - 1 * dayMs);
    const result = computeCandidateReminderWindows(
      dueAt,
      now,
      { approachingDays: [2], overdueDays: [1] },
      []
    );
    expect(result).toEqual(['overdue:1']);
  });

  it('fires multiple windows in one tick after downtime', () => {
    const dueAt = new Date(now.getTime() - 5 * dayMs);
    const result = computeCandidateReminderWindows(
      dueAt,
      now,
      { approachingDays: [2], overdueDays: [1, 3, 5] },
      []
    );
    expect(result.sort()).toEqual(['overdue:1', 'overdue:3', 'overdue:5'].sort());
  });
});

const makeCase = (overrides: Partial<GovernanceCaseDbResult> = {}): GovernanceCaseDbResult => ({
  id: 'case-1',
  workspace: 'ws-1',
  case_kind: 'entity.change-case',
  case_subkind: null,
  subject_type: 'entity',
  subject_id: 'entity-1',
  subject_version: null,
  status: 'open',
  outcome: null,
  policy_version: null,
  initiator_user_id: 'user-1',
  parent_case_id: null,
  self_approval_allowed: false,
  payload: {},
  created_at: now,
  due_at: new Date(now.getTime() - 1 * dayMs),
  completed_at: null,
  cancelled_at: null,
  reminder_windows_sent: [],
  escalated_at: null,
  ...overrides
});

const makeCaseConfigRow = (
  overrides: Partial<GovernanceCaseConfigDbResult> = {}
): GovernanceCaseConfigDbResult => ({
  id: 'config-1',
  workspace: 'ws-1',
  case_kind: 'entity.change-case',
  case_subkind: null,
  enabled: true,
  config: {
    reminders: { enabled: true, approachingDays: [2], overdueDays: [1] },
    escalation: {
      enabled: true,
      overdueDays: 1,
      fallbackUserIds: [],
      fallbackTeamIds: []
    },
    extensions: {}
  },
  updated_at: now,
  updated_by: null,
  ...overrides
});

const makeDb = (
  cases: GovernanceCaseDbResult[],
  caseConfig: GovernanceCaseConfigDbResult | null
) => {
  const store = new Map(cases.map(c => [c.id, c]));
  const addReminderWindowSent = vi.fn(async (id: string, window: string) => {
    const current = store.get(id);
    if (!current || current.reminder_windows_sent.includes(window)) return null;
    const updated = {
      ...current,
      reminder_windows_sent: [...current.reminder_windows_sent, window]
    };
    store.set(id, updated);
    return updated;
  });

  const markEscalated = vi.fn(async (id: string, escalatedAt: Date) => {
    const current = store.get(id);
    if (!current || current.status !== 'open' || current.escalated_at) return null;
    const updated = { ...current, escalated_at: escalatedAt };
    store.set(id, updated);
    return updated;
  });

  const governance = {
    listCases: vi.fn(async () => [...store.values()]),
    getCase: vi.fn(async (_workspace: string, id: string) => store.get(id) ?? null),
    appendEvent: vi.fn(async (input: Record<string, unknown>) => ({
      id: 'event-1',
      occurred_at: now,
      ...input
    })),
    addReminderWindowSent,
    markEscalated
  };

  const governanceCaseConfig = {
    listCaseConfig: vi.fn(async () => (caseConfig ? [caseConfig] : []))
  };

  const db = {
    governance,
    governanceCaseConfig,
    core: {
      transaction: vi.fn(async (callback: (tx: DatabaseAdapter) => Promise<void>) => callback(db))
    }
  } as unknown as DatabaseAdapter;

  return {
    db,
    store,
    addReminderWindowSent,
    markEscalated,
    appendEvent: governance.appendEvent
  };
};

const registryWithDefault = (): GovernanceRegistry => {
  const registry = createGovernanceRegistry();
  registry.set('entity.change-case', {
    reminders: { approachingDays: [2], overdueDays: [1] }
  });
  return registry;
};

const registryWithEscalation = (
  target: GovernanceAssignmentTarget | null = { type: 'capability', capability: 'ws.settings' }
): GovernanceRegistry => {
  const registry = createGovernanceRegistry();
  registry.set('entity.change-case', {
    reminders: { approachingDays: [2], overdueDays: [1] },
    escalation: { overdueDays: 5, target: async () => target }
  });
  return registry;
};

const createHandler = (db: DatabaseAdapter, registry: GovernanceRegistry) =>
  createGovernanceDeadlineScanJobHandler(db, registry, () => now);

describe('createGovernanceDeadlineScanJobHandler', () => {
  it('sends a reminder and records reminder_windows_sent for an overdue case', async () => {
    const caseRow = makeCase();
    const { db, store, addReminderWindowSent, appendEvent } = makeDb([caseRow], null);
    const handler = createHandler(db, registryWithDefault());

    const result = await handler({ workspace: 'ws-1', payload: {} });

    expect(result).toEqual({ scanned: 1, remindersSent: 1, escalationsSent: 0 });
    expect(appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'reminder_sent',
        metadata: { trigger: 'scheduled', window: 'overdue:1' }
      })
    );
    expect(addReminderWindowSent).toHaveBeenCalledWith('case-1', 'overdue:1');
    expect(store.get('case-1')!.reminder_windows_sent).toEqual(['overdue:1']);
  });

  it('does not re-send a window already recorded on the case', async () => {
    const caseRow = makeCase({ reminder_windows_sent: ['overdue:1'] });
    const { db, appendEvent } = makeDb([caseRow], null);
    const handler = createHandler(db, registryWithDefault());

    const result = await handler({ workspace: 'ws-1', payload: {} });

    expect(result.remindersSent).toBe(0);
    expect(appendEvent).not.toHaveBeenCalled();
  });

  it('skips a case whose kind has no reminders configured', async () => {
    const caseRow = makeCase({ case_kind: 'document.status-case' });
    const { db, appendEvent } = makeDb([caseRow], null);
    const handler = createHandler(db, registryWithDefault());

    const result = await handler({ workspace: 'ws-1', payload: {} });

    expect(result.remindersSent).toBe(0);
    expect(appendEvent).not.toHaveBeenCalled();
  });

  it('skips a completed case even though it matches a window', async () => {
    const caseRow = makeCase({ status: 'completed' });
    const { db, appendEvent } = makeDb([caseRow], null);
    // listCases is mocked to return whatever is in the store regardless of the status filter
    // passed in, matching how the real query would already exclude non-open cases — verify the
    // handler's own re-fetch-inside-transaction guard independently by forcing a status flip.
    const handler = createHandler(db, registryWithDefault());

    await handler({ workspace: 'ws-1', payload: {} });

    expect(appendEvent).not.toHaveBeenCalled();
  });

  it('uses a workspace override that disables reminders for a kind', async () => {
    const caseRow = makeCase();
    const override = makeCaseConfigRow({
      enabled: false,
      config: { reminders: { enabled: false, approachingDays: [], overdueDays: [] } }
    });
    const { db, appendEvent } = makeDb([caseRow], override);
    const handler = createHandler(db, registryWithDefault());

    const result = await handler({ workspace: 'ws-1', payload: {} });

    expect(result.remindersSent).toBe(0);
    expect(appendEvent).not.toHaveBeenCalled();
  });

  it('uses a workspace override’s custom day thresholds instead of the code default', async () => {
    // Code default overdueDays is [1]; override changes it to [5], and the case is only 1 day
    // overdue, so nothing should fire yet under the override.
    const caseRow = makeCase();
    const override = makeCaseConfigRow({
      config: { reminders: { enabled: true, approachingDays: [], overdueDays: [5] } }
    });
    const { db, appendEvent } = makeDb([caseRow], override);
    const handler = createHandler(db, registryWithDefault());

    const result = await handler({ workspace: 'ws-1', payload: {} });

    expect(result.remindersSent).toBe(0);
    expect(appendEvent).not.toHaveBeenCalled();
  });

  it('uses a subkind override for a scoped case', async () => {
    const caseRow = makeCase({ case_subkind: 'schema-1' });
    const override = makeCaseConfigRow({
      case_subkind: 'schema-1',
      config: { reminders: { enabled: true, approachingDays: [], overdueDays: [5] } }
    });
    const { db, appendEvent } = makeDb([caseRow], override);
    const handler = createHandler(db, registryWithDefault());

    const result = await handler({ workspace: 'ws-1', payload: {} });

    expect(result.remindersSent).toBe(0);
    expect(appendEvent).not.toHaveBeenCalled();
  });

  it('keeps code reminder defaults when a config row has no reminder component', async () => {
    const caseRow = makeCase();
    const approvalOnly = makeCaseConfigRow({ config: { approvals: { requiredApprovals: 1 } } });
    const { db, appendEvent } = makeDb([caseRow], approvalOnly);
    const handler = createHandler(db, registryWithDefault());

    const result = await handler({ workspace: 'ws-1', payload: {} });

    expect(result.remindersSent).toBe(1);
    expect(appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({ metadata: { trigger: 'scheduled', window: 'overdue:1' } })
    );
  });

  it('escalates an overdue case once the escalation threshold is crossed', async () => {
    const target: GovernanceAssignmentTarget = { type: 'capability', capability: 'ws.settings' };
    const caseRow = makeCase({ due_at: new Date(now.getTime() - 5 * dayMs) });
    const { db, store, markEscalated, appendEvent } = makeDb([caseRow], null);
    const handler = createHandler(db, registryWithEscalation(target));

    const result = await handler({ workspace: 'ws-1', payload: {} });

    expect(result.escalationsSent).toBe(1);
    expect(appendEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: 'escalated',
        metadata: { trigger: 'scheduled', target }
      })
    );
    expect(markEscalated).toHaveBeenCalledWith('case-1', expect.any(Date));
    expect(store.get('case-1')!.escalated_at).toBeInstanceOf(Date);
  });

  it('does not escalate a case below the overdue threshold', async () => {
    const caseRow = makeCase({ due_at: new Date(now.getTime() - 1 * dayMs) });
    const { db, appendEvent } = makeDb([caseRow], null);
    const handler = createHandler(db, registryWithEscalation());

    const result = await handler({ workspace: 'ws-1', payload: {} });

    expect(result.escalationsSent).toBe(0);
    expect(appendEvent).not.toHaveBeenCalledWith(
      expect.objectContaining({ event_type: 'escalated' })
    );
  });

  it('does not re-escalate a case that is already escalated', async () => {
    const caseRow = makeCase({
      due_at: new Date(now.getTime() - 5 * dayMs),
      escalated_at: new Date(now.getTime() - 1 * dayMs)
    });
    const { db, markEscalated } = makeDb([caseRow], null);
    const handler = createHandler(db, registryWithEscalation());

    const result = await handler({ workspace: 'ws-1', payload: {} });

    expect(result.escalationsSent).toBe(0);
    expect(markEscalated).not.toHaveBeenCalled();
  });

  it('skips escalation for a case kind with no escalation config', async () => {
    const caseRow = makeCase({ due_at: new Date(now.getTime() - 5 * dayMs) });
    const { db } = makeDb([caseRow], null);
    const handler = createHandler(db, registryWithDefault());

    const result = await handler({ workspace: 'ws-1', payload: {} });

    expect(result.escalationsSent).toBe(0);
  });

  it('respects a workspace override that disables escalation for a kind', async () => {
    const caseRow = makeCase({ due_at: new Date(now.getTime() - 5 * dayMs) });
    const override = makeCaseConfigRow({
      config: {
        escalation: {
          enabled: false,
          overdueDays: 5,
          fallbackUserIds: [],
          fallbackTeamIds: []
        }
      }
    });
    const { db } = makeDb([caseRow], override);
    const handler = createHandler(db, registryWithEscalation());

    const result = await handler({ workspace: 'ws-1', payload: {} });

    expect(result.escalationsSent).toBe(0);
  });
});
