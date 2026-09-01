import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { EntityDbResult, SchemaDbResult } from './db/catalogDatabase';
import type {
  GovernanceCaseDbResult,
  GovernanceEventDbResult
} from '../governance/db/governanceDatabase';
import {
  FIELD_DATE_REMINDER_CASE_KIND,
  createFieldDateReminderGovernanceRegistry,
  syncFieldDateReminderCases
} from './fieldDateReminderJob';
import { encodeCaseSubkind } from '../governance/governanceCaseSubkind';

vi.mock('../governance/governanceNotifications', () => ({
  createGovernanceInAppNotifications: vi.fn(async () => ({ recipients: 0 }))
}));

const updateEntityWithAudit = vi.fn<
  (db: unknown, params: { next: { data: Record<string, unknown> } }) => Promise<unknown>
>(async () => ({}));
vi.mock('./entityMutations', () => ({
  updateEntityWithAudit: (db: unknown, params: { next: { data: Record<string, unknown> } }) =>
    updateEntityWithAudit(db, params)
}));
vi.mock('./enumOptions', () => ({ getWorkspaceEnumDefinitions: vi.fn(async () => []) }));

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
      type: 'date'
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
    governanceCaseConfig: {
      listCaseConfigForKind: vi.fn(async () => [
        {
          id: 'config-1',
          workspace: 'ws-1',
          case_kind: FIELD_DATE_REMINDER_CASE_KIND,
          case_subkind: encodeCaseSubkind(schema.id, 'eol_date'),
          enabled: true,
          config: { approaching_days: [3], overdue_days: [1] },
          updated_at: now,
          updated_by: null
        }
      ]),
      getCaseConfig: vi.fn(async () => ({
        id: 'config-1',
        workspace: 'ws-1',
        case_kind: FIELD_DATE_REMINDER_CASE_KIND,
        case_subkind: encodeCaseSubkind(schema.id, 'eol_date'),
        enabled: true,
        config: { approaching_days: [3], overdue_days: [1] },
        updated_at: now,
        updated_by: null
      }))
    },
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

const stewardshipSchema: SchemaDbResult = {
  ...schema,
  id: 'data-entity',
  fields: [
    { id: 'review_date', name: 'Review Date', type: 'date' },
    { id: 'steward', name: 'Steward', type: 'principal' }
  ]
};

const makeStewardshipDb = (config: Record<string, unknown>, stewardValue: unknown) => {
  const stewardEntity: EntityDbResult = {
    ...entity,
    schema_id: stewardshipSchema.id,
    data: { review_date: '2026-08-10', steward: stewardValue }
  };
  const createdAssignments: Array<Record<string, unknown>> = [];
  const cases = new Map<string, GovernanceCaseDbResult>();
  const configRow = {
    id: 'config-1',
    workspace: 'ws-1',
    case_kind: FIELD_DATE_REMINDER_CASE_KIND,
    case_subkind: encodeCaseSubkind(stewardshipSchema.id, 'review_date'),
    enabled: true,
    config,
    updated_at: now,
    updated_by: null
  };
  const db = {
    core: {
      transaction: vi.fn(async (callback: (tx: DatabaseAdapter) => unknown) =>
        callback(db as DatabaseAdapter)
      ),
      isTransaction: true
    },
    catalog: {
      listSchemas: vi.fn(async () => [stewardshipSchema]),
      listEntitiesPaginated: vi.fn(async (_ws: string, _f: unknown, page: { offset?: number }) =>
        (page.offset ?? 0) === 0 ? [stewardEntity] : []
      ),
      getEntity: vi.fn(async () => stewardEntity),
      getSchema: vi.fn(async () => stewardshipSchema)
    },
    workspace: { listTeams: vi.fn(async () => [{ id: 'team-1' }]) },
    governanceCaseConfig: {
      listCaseConfigForKind: vi.fn(async () => [configRow]),
      getCaseConfig: vi.fn(async () => configRow)
    },
    governance: {
      listCases: vi.fn(async () => [...cases.values()]),
      getCaseByDedupeKey: vi.fn(async () => null),
      getCase: vi.fn(async (_ws: string, id: string) => cases.get(id) ?? null),
      createCase: vi.fn(async (input: GovernanceCaseDbResult) => {
        const created = { ...input, status: 'open' as const };
        cases.set(created.id, created);
        return created;
      }),
      createAssignment: vi.fn(async (input: Record<string, unknown>) => {
        createdAssignments.push(input);
        return input;
      }),
      listAssignmentsForCase: vi.fn(async () => []),
      appendEvent: vi.fn(async () => ({ id: 'event-1', metadata: {} }))
    },
    notification: {
      markReadByAssignmentIds: vi.fn(async () => {}),
      markReadByCaseIds: vi.fn(async () => {})
    }
  } as unknown as DatabaseAdapter;
  return { db, createdAssignments };
};

describe('field-date-reminder routing', () => {
  it('routes the reminder to the configured principal field', async () => {
    const { db, createdAssignments } = makeStewardshipDb(
      {
        reminders: { enabled: true, approachingDays: [3], overdueDays: [1] },
        approvals: {
          requiredApprovals: 1,
          strategy: 'entity-principal-field',
          strategyConfig: { fieldId: 'steward' },
          fallbackUserIds: [],
          fallbackTeamIds: []
        }
      },
      { principal_type: 'user', principal_id: 'user-9' }
    );

    await syncFieldDateReminderCases(db, 'ws-1', now);

    expect(createdAssignments).toHaveLength(1);
    expect(createdAssignments[0]).toMatchObject({
      target_type: 'user',
      target_user_id: 'user-9'
    });
  });

  it('falls back to the owning team when the principal field is empty', async () => {
    const { db, createdAssignments } = makeStewardshipDb(
      {
        reminders: { enabled: true, approachingDays: [3], overdueDays: [1] },
        approvals: {
          requiredApprovals: 1,
          strategy: 'entity-principal-field',
          strategyConfig: { fieldId: 'steward' },
          fallbackUserIds: [],
          fallbackTeamIds: []
        }
      },
      null
    );

    await syncFieldDateReminderCases(db, 'ws-1', now);

    expect(createdAssignments[0]).toMatchObject({
      target_type: 'team_role',
      target_team_id: 'team-1',
      target_team_role: 'team_admin'
    });
  });
});

describe('field-date-reminder completion advance', () => {
  const registry = createFieldDateReminderGovernanceRegistry();
  const kind = registry.get(FIELD_DATE_REMINDER_CASE_KIND)!;

  it('advances the triggering date field on acknowledgement', async () => {
    updateEntityWithAudit.mockClear();
    const advanceEntity: EntityDbResult = {
      ...entity,
      schema_id: stewardshipSchema.id,
      data: { review_date: '2026-01-15' }
    };
    const tx = {
      governanceCaseConfig: {
        getCaseConfig: vi.fn(async () => ({
          case_subkind: encodeCaseSubkind(stewardshipSchema.id, 'review_date'),
          enabled: true,
          config: {
            reminders: { enabled: true, approachingDays: [3], overdueDays: [1] },
            extensions: { completionAdvance: { amount: 1, unit: 'years' } }
          }
        }))
      },
      catalog: {
        getEntity: vi.fn(async () => advanceEntity),
        getSchema: vi.fn(async () => stewardshipSchema)
      }
    } as unknown as DatabaseAdapter;

    const caseRow = {
      id: 'case-1',
      workspace: 'ws-1',
      subject_id: advanceEntity.id,
      payload: {
        schemaId: stewardshipSchema.id,
        fieldId: 'review_date',
        dateValue: '2026-01-15'
      }
    } as unknown as GovernanceCaseDbResult;

    await kind.applyDomainEffect!(tx, {
      case: caseRow,
      event: {} as never
    });

    expect(updateEntityWithAudit).toHaveBeenCalledTimes(1);
    const call = updateEntityWithAudit.mock.calls[0]![1];
    expect(call.next.data.review_date).toBe('2027-01-15');
  });

  it('does nothing when no completion advance is configured', async () => {
    updateEntityWithAudit.mockClear();
    const tx = {
      governanceCaseConfig: {
        getCaseConfig: vi.fn(async () => ({
          case_subkind: encodeCaseSubkind(stewardshipSchema.id, 'review_date'),
          enabled: true,
          config: { reminders: { enabled: true, approachingDays: [3], overdueDays: [1] } }
        }))
      },
      catalog: { getEntity: vi.fn(), getSchema: vi.fn() }
    } as unknown as DatabaseAdapter;

    await kind.applyDomainEffect!(tx, {
      case: {
        id: 'case-1',
        workspace: 'ws-1',
        subject_id: 'entity-1',
        payload: { schemaId: stewardshipSchema.id, fieldId: 'review_date', dateValue: '2026-01-15' }
      } as unknown as GovernanceCaseDbResult,
      event: {} as never
    });

    expect(updateEntityWithAudit).not.toHaveBeenCalled();
  });
});

describe('field-date-reminder governance redaction', () => {
  it('redacts the date value when the caller cannot view the configured field', async () => {
    const restrictedSchema: SchemaDbResult = {
      ...schema,
      fields: [{ ...schema.fields[0]!, groupId: 'restricted' }],
      groups: [{ id: 'restricted', name: 'Restricted', accessControl: { teamIds: ['team-owner'] } }]
    };
    const db = {
      catalog: {
        getEntity: vi.fn(async () => entity),
        getSchema: vi.fn(async () => restrictedSchema)
      }
    } as unknown as DatabaseAdapter;
    const authCtx = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'editor',
      teamAssignments: [],
      schemas: [],
      entities: [],
      grants: []
    });
    const caseRow = {
      id: 'case-1',
      workspace: 'ws-1',
      case_kind: FIELD_DATE_REMINDER_CASE_KIND,
      subject_id: entity.id,
      payload: {
        schemaId: schema.id,
        fieldId: 'eol_date',
        fieldName: 'EOL date',
        dateValue: '2026-08-10',
        ownerTeamId: entity.owner,
        opaquePayload: { preserved: true }
      }
    } as unknown as GovernanceCaseDbResult;
    const eventRow = {
      id: 'event-1',
      case_id: caseRow.id,
      metadata: { assignmentId: 'assignment-1', dateValue: '2026-08-10' }
    } as unknown as GovernanceEventDbResult;
    const kind = createFieldDateReminderGovernanceRegistry().get(FIELD_DATE_REMINDER_CASE_KIND)!;

    await expect(kind.redactCasePayload!({ db, authCtx, caseRow, mode: 'api' })).resolves.toEqual({
      schemaId: schema.id,
      fieldId: 'eol_date',
      fieldName: 'EOL date',
      ownerTeamId: entity.owner,
      opaquePayload: { preserved: true }
    });
    await expect(
      kind.redactEventMetadata!({
        db,
        authCtx: null,
        caseRow,
        event: eventRow,
        mode: 'outbound'
      })
    ).resolves.toEqual({ assignmentId: 'assignment-1' });
  });
});
