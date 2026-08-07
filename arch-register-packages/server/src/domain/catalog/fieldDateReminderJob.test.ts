import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import type { GovernanceCaseDbResult } from '../governance/db/governanceDatabase';
import { FIELD_DATE_REMINDER_CASE_KIND, syncFieldDateReminderCases } from './fieldDateReminderJob';

vi.mock('../governance/governanceNotifications', () => ({
  createGovernanceInAppNotifications: vi.fn(async () => ({ recipients: 0 }))
}));

const now = new Date('2026-08-07T12:00:00.000Z');

const schema: SchemaDbResult = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Technology',
  description: '',
  fields: [
    {
      id: 'eol_date',
      name: 'EOL date',
      type: 'date',
      reminder: { enabled: true, approachingDays: [3], overdueDays: [1] }
    }
  ],
  templates: [],
  groups: [],
  color: null,
  icon: null,
  default_owner: null,
  key_prefix: 'TECH',
  created_at: now,
  updated_at: now
};

const entity: EntityDbResult = {
  id: 'entity-1',
  workspace: 'ws-1',
  public_id: 'TECH-1',
  slug: 'service',
  namespace: '',
  name: 'Service',
  description: '',
  owner: 'team-1',
  lifecycle: null,
  target_lifecycle: null,
  target_lifecycle_date: null,
  tags: [],
  links: [],
  schema_id: schema.id,
  data: { eol_date: '2026-08-10' },
  project_id: null,
  created_at: now,
  updated_at: now,
  completeness: 100,
  owner_name: 'Platform',
  lifecycle_label: null,
  target_lifecycle_label: null,
  schema_name: schema.name
};

const makeDb = () => {
  const cases = new Map<string, GovernanceCaseDbResult>();
  const assignments = new Map<string, { case_id: string; status: 'open' | 'superseded' }>();
  const db = {
    core: {
      transaction: vi.fn(async (callback: (tx: DatabaseAdapter) => unknown) =>
        callback(db as DatabaseAdapter)
      )
    },
    catalog: {
      listSchemas: vi.fn(async () => [schema]),
      listEntitiesPaginated: vi.fn(
        async (_workspace: string, _filters: unknown, page: { offset?: number }) =>
          (page.offset ?? 0) === 0 ? [entity] : []
      ),
      getEntity: vi.fn(async () => entity),
      getSchema: vi.fn(async () => schema)
    },
    workspace: { listTeams: vi.fn(async () => [{ id: 'team-1' }]) },
    governance: {
      listCases: vi.fn(async () => [...cases.values()]),
      getCaseByDedupeKey: vi.fn(
        async (_workspace: string, _kind: string, key: string) =>
          [...cases.values()].find(item => item.dedupe_key === key) ?? null
      ),
      getCase: vi.fn(async (_workspace: string, id: string) => cases.get(id) ?? null),
      createCase: vi.fn(async (input: GovernanceCaseDbResult) => {
        const created = {
          ...input,
          status: 'open' as const,
          outcome: null,
          completed_at: null,
          cancelled_at: null,
          reminder_windows_sent: [],
          escalated_at: null
        };
        cases.set(created.id, created);
        return created;
      }),
      createAssignment: vi.fn(async (input: { id: string; case_id: string; status?: 'open' }) => {
        assignments.set(input.id, { case_id: input.case_id, status: 'open' });
        return input;
      }),
      listAssignmentsForCase: vi.fn(async (caseId: string) =>
        [...assignments.entries()]
          .filter(([, assignment]) => assignment.case_id === caseId)
          .map(([id, assignment]) => ({
            id,
            case_id: assignment.case_id,
            workspace: 'ws-1',
            action: 'acknowledge' as const,
            target_type: 'team_role' as const,
            target_user_id: null,
            target_team_id: 'team-1',
            target_team_role: 'team_admin' as const,
            target_capability: null,
            status: assignment.status,
            created_at: now,
            resolved_at: null
          }))
      ),
      appendEvent: vi.fn(async (input: Record<string, unknown>) => ({
        id: 'event-1',
        case_id: input.case_id,
        workspace: 'ws-1',
        event_type: input.event_type,
        actor_user_id: null,
        occurred_at: now,
        previous_status: null,
        resulting_status: null,
        reason: null,
        metadata: {}
      })),
      cancelCaseIfOpen: vi.fn(async (id: string, cancelledAt: Date) => {
        const current = cases.get(id);
        if (!current || current.status !== 'open') return null;
        const cancelled = { ...current, status: 'cancelled' as const, cancelled_at: cancelledAt };
        cases.set(id, cancelled);
        return cancelled;
      }),
      supersedeAllOpenAssignmentsForCase: vi.fn(async (caseId: string) => {
        const ids: string[] = [];
        for (const [id, assignment] of assignments) {
          if (assignment.case_id === caseId && assignment.status === 'open') {
            assignment.status = 'superseded';
            ids.push(id);
          }
        }
        return ids;
      }),
      refreshAutomaticCase: vi.fn(
        async (id: string, dueAt: Date, payload: Record<string, unknown>) => {
          const current = cases.get(id)!;
          const refreshed = {
            ...current,
            due_at: dueAt,
            payload,
            reminder_windows_sent: [],
            escalated_at: null
          };
          cases.set(id, refreshed);
          return refreshed;
        }
      )
    },
    notification: {
      markReadByAssignmentIds: vi.fn(async () => {}),
      markReadByCaseIds: vi.fn(async () => {})
    }
  } as unknown as DatabaseAdapter;
  return { db, cases };
};

describe('syncFieldDateReminderCases', () => {
  it('creates one case and reuses it on a repeated scan', async () => {
    const { db, cases } = makeDb();

    const first = await syncFieldDateReminderCases(db, 'ws-1', now);
    const second = await syncFieldDateReminderCases(db, 'ws-1', now);

    expect(first.created).toBe(1);
    expect(second.created).toBe(0);
    expect(cases.size).toBe(1);
    expect([...cases.values()][0]?.case_kind).toBe(FIELD_DATE_REMINDER_CASE_KIND);
  });

  it('refreshes a changed date and cancels the case when the date is cleared', async () => {
    const { db, cases } = makeDb();
    await syncFieldDateReminderCases(db, 'ws-1', now);

    entity.data.eol_date = '2026-09-01';
    const refreshed = await syncFieldDateReminderCases(db, 'ws-1', now);
    expect(refreshed.refreshed).toBe(1);
    expect([...cases.values()][0]?.due_at?.toISOString()).toBe('2026-09-01T00:00:00.000Z');

    entity.data.eol_date = null;
    const cancelled = await syncFieldDateReminderCases(db, 'ws-1', now);
    expect(cancelled.cancelled).toBe(1);
    expect([...cases.values()][0]?.status).toBe('cancelled');
  });
});
