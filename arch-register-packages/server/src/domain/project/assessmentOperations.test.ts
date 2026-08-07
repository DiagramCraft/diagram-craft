import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { AssessmentDbResult } from './db/projectDatabase';
import {
  ASSESSMENT_RESPONSE_CASE_KIND,
  createAssessmentGovernanceRegistry,
  getAssessment,
  listAssessments,
  updateAssessmentStatus
} from './assessmentOperations';
import type { GovernanceCaseDbResult } from '../governance/db/governanceDatabase';
import { listAllCatalogEntities } from '../catalog/entityLoader';

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => ({ userId: 'user-1' })),
  canAccessProject: vi.fn((_context, owner) => owner === 'allowed'),
  requireProjectAccess: vi.fn(),
  requireProjectAction: vi.fn()
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

vi.mock('../catalog/entityLoader', () => ({
  listAllCatalogEntities: vi.fn(async () => [])
}));

vi.mock('../audit/db/auditLogging', () => ({
  logAudit: vi.fn(async () => {}),
  extractEntityFields: (o: Record<string, unknown>) => o,
  computeChanges: () => ({})
}));

vi.mock('../governance/governanceNotifications', () => ({
  createGovernanceInAppNotifications: vi.fn(async () => {})
}));

const now = new Date('2026-06-01T12:00:00.000Z');

const assessment = (id: string, projectId: string): AssessmentDbResult => ({
  id,
  workspace: 'ws-1',
  project_id: projectId,
  name: id,
  description: '',
  status: 'open',
  mode: 'fields',
  scope: [],
  scope_conditions: [],
  groups: [],
  assigned_team_ids: [],
  due_at: null,
  recurrence: { type: 'none' },
  response_window_days: null,
  current_occurrence: 1,
  pending_occurrence_job_run_id: null,
  next_occurrence_at: null,
  fields: [],
  created_at: now,
  updated_at: now
});

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

describe('createAssessmentGovernanceRegistry', () => {
  it('marks approval as unsupported while exposing reminder and escalation settings', () => {
    expect(
      createAssessmentGovernanceRegistry().get(ASSESSMENT_RESPONSE_CASE_KIND)?.workflowConfig
    ).toEqual({
      supportsApprovals: false,
      supportsReminders: true,
      supportsEscalation: true
    });
  });
});

describe('listAssessments', () => {
  it('only returns assessments owned by projects the caller can access', async () => {
    const db = {
      project: {
        listAssessments: vi.fn(async () => [
          assessment('visible-assessment', 'project-visible'),
          assessment('hidden-assessment', 'project-hidden')
        ]),
        listProjects: vi.fn(async () => [
          { id: 'project-visible', name: 'Visible project', owner: 'allowed' },
          { id: 'project-hidden', name: 'Hidden project', owner: 'denied' }
        ]),
        listAssessmentResponses: vi.fn(async () => [])
      },
      catalog: { listSchemas: vi.fn(async () => []) }
    } as unknown as DatabaseAdapter;

    const result = await listAssessments(db, 'ws-1', event);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 'visible-assessment',
      project_id: 'project-visible'
    });
  });
});

describe('updateAssessmentStatus', () => {
  const project = { id: 'project-1', owner: 'allowed' };

  const makeDb = (overrides: Partial<AssessmentDbResult> = {}) => {
    const row = { ...assessment('assessment-1', project.id), status: 'draft', ...overrides };
    const updated = { ...row, status: 'draft' as AssessmentDbResult['status'] };
    const governance = {
      createCase: vi.fn(async (input: Record<string, unknown>) => ({
        ...input,
        status: 'open'
      })) as unknown as (input: unknown) => Promise<GovernanceCaseDbResult>,
      createAssignment: vi.fn(async (input: unknown) => input),
      appendEvent: vi.fn(async (input: unknown) => input),
      listCases: vi.fn(async () => [] as GovernanceCaseDbResult[]),
      completeCaseIfOpen: vi.fn(async (id: string) => ({
        id,
        status: 'completed'
      })) as unknown as (
        id: string,
        outcome: string | null,
        at: Date
      ) => Promise<GovernanceCaseDbResult | null>,
      supersedeAllOpenAssignmentsForCase: vi.fn(async () => [] as string[]),
      listAssignmentsForCase: vi.fn(async () => [])
    };
    const db = {
      project: {
        getAssessmentById: vi.fn(async () => row),
        getProject: vi.fn(async () => project),
        updateAssessment: vi.fn(async (_ws: string, _pid: string, _id: string, patch: unknown) => ({
          ...updated,
          ...(patch as Record<string, unknown>)
        })),
        listAssessmentResponses: vi.fn(async () => [])
      },
      catalog: { listSchemas: vi.fn(async () => []) },
      workspace: {
        listTeams: vi.fn(async () => [])
      },
      governance: governance,
      notification: {
        markReadByAssignmentIds: vi.fn(async () => {}),
        markReadByCaseIds: vi.fn(async () => {})
      },
      core: {
        transaction: vi.fn((fn: (tx: DatabaseAdapter) => Promise<unknown>) =>
          fn(db as unknown as DatabaseAdapter)
        )
      }
    };
    return { db: db as unknown as DatabaseAdapter, governance, row };
  };

  it('creates a governance case with one acknowledge assignment per assigned team when opened', async () => {
    const { db, governance } = makeDb({ assigned_team_ids: ['team-a', 'team-b'], due_at: null });

    await updateAssessmentStatus(db, 'ws-1', 'assessment-1', { status: 'open' }, event);

    expect(governance.createCase).toHaveBeenCalledWith(
      expect.objectContaining({
        case_kind: ASSESSMENT_RESPONSE_CASE_KIND,
        subject_id: 'assessment-1'
      })
    );
    expect(governance.createAssignment).toHaveBeenCalledTimes(2);
    expect(governance.createAssignment).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'acknowledge',
        target_type: 'team',
        target_team_id: 'team-a'
      })
    );
  });

  it('does not create a governance case when no teams are assigned', async () => {
    const { db, governance } = makeDb({ assigned_team_ids: [] });

    await updateAssessmentStatus(db, 'ws-1', 'assessment-1', { status: 'open' }, event);

    expect(governance.createCase).not.toHaveBeenCalled();
  });

  it('preserves groups on a status-only update', async () => {
    const { db } = makeDb({ groups: [{ id: 'g1', name: 'Basics' }] });

    await updateAssessmentStatus(db, 'ws-1', 'assessment-1', { status: 'open' }, event);

    expect(db.project.updateAssessment).toHaveBeenCalledWith(
      'ws-1',
      'project-1',
      'assessment-1',
      expect.objectContaining({ groups: [{ id: 'g1', name: 'Basics' }] })
    );
  });

  it('closes the open governance case when the assessment leaves open status', async () => {
    const openCase: GovernanceCaseDbResult = {
      id: 'case-1',
      workspace: 'ws-1',
      caseKind: ASSESSMENT_RESPONSE_CASE_KIND,
      status: 'open'
    } as unknown as GovernanceCaseDbResult;
    const { db, governance } = makeDb({ status: 'open', assigned_team_ids: ['team-a'] });
    governance.listCases.mockResolvedValue([openCase]);

    await updateAssessmentStatus(db, 'ws-1', 'assessment-1', { status: 'closed' }, event);

    expect(governance.completeCaseIfOpen).toHaveBeenCalledWith(
      'case-1',
      'closed',
      expect.any(Date)
    );
    expect(governance.supersedeAllOpenAssignmentsForCase).toHaveBeenCalledWith(
      'case-1',
      expect.any(Date)
    );
  });
});

describe('getAssessment team_acknowledge_status', () => {
  const project = { id: 'project-1', owner: 'allowed' };

  it('is empty when no teams are assigned', async () => {
    const row = assessment('assessment-1', project.id);
    const db = {
      project: {
        getAssessmentById: vi.fn(async () => row),
        getProject: vi.fn(async () => project),
        listAssessmentResponses: vi.fn(async () => [])
      },
      catalog: { listSchemas: vi.fn(async () => []) },
      governance: { listCases: vi.fn(async () => []) },
      workspace: { listTeams: vi.fn(async () => []) }
    } as unknown as DatabaseAdapter;

    const result = await getAssessment(db, 'ws-1', 'assessment-1', event);

    expect(result.team_acknowledge_status).toEqual([]);
  });

  it('resolves per-team status and names from the latest governance case', async () => {
    const row = {
      ...assessment('assessment-1', project.id),
      assigned_team_ids: ['team-a', 'team-b']
    };
    const resolvedAt = new Date('2026-06-02T00:00:00.000Z');
    const db = {
      project: {
        getAssessmentById: vi.fn(async () => row),
        getProject: vi.fn(async () => project),
        listAssessmentResponses: vi.fn(async () => [])
      },
      governance: {
        listCases: vi.fn(async () => [
          { id: 'case-1', created_at: new Date('2026-06-01T00:00:00.000Z') }
        ]),
        listAssignmentsForCase: vi.fn(async () => [
          {
            id: 'assign-a',
            target_type: 'team',
            target_team_id: 'team-a',
            status: 'open',
            resolved_at: null
          },
          {
            id: 'assign-b',
            target_type: 'team',
            target_team_id: 'team-b',
            status: 'completed',
            resolved_at: resolvedAt
          }
        ])
      },
      workspace: {
        listTeams: vi.fn(async () => [
          { id: 'team-a', name: 'Team A' },
          { id: 'team-b', name: 'Team B' }
        ])
      },
      catalog: { listSchemas: vi.fn(async () => []) }
    } as unknown as DatabaseAdapter;

    const result = await getAssessment(db, 'ws-1', 'assessment-1', event);

    expect(result.team_acknowledge_status).toEqual([
      { team_id: 'team-a', team_name: 'Team A', status: 'open', resolved_at: null },
      {
        team_id: 'team-b',
        team_name: 'Team B',
        status: 'completed',
        resolved_at: resolvedAt.toISOString()
      }
    ]);
  });

  it('fails closed for stale scope conditions in assessment statistics and API output', async () => {
    const row = {
      ...assessment('assessment-1', project.id),
      scope: ['schema-missing'],
      scope_conditions: [{ fieldId: 'removed-field', op: 'equals' as const, value: 'classified' }]
    };
    const db = {
      project: {
        getAssessmentById: vi.fn(async () => row),
        getProject: vi.fn(async () => project),
        listAssessmentResponses: vi.fn(async () => [
          {
            id: 'response-1',
            workspace: 'ws-1',
            assessment_id: row.id,
            entity_id: 'entity-1',
            occurrence: 1,
            values: {},
            created_at: now,
            updated_at: now,
            updated_by: null,
            updated_by_name: null
          }
        ])
      },
      catalog: { listSchemas: vi.fn(async () => []) },
      governance: { listCases: vi.fn(async () => []) },
      workspace: { listTeams: vi.fn(async () => []) }
    } as unknown as DatabaseAdapter;
    vi.mocked(listAllCatalogEntities).mockResolvedValueOnce([
      {
        id: 'entity-1',
        schema_id: 'schema-missing',
        data: { 'removed-field': 'classified' }
      }
    ] as never);

    const result = await getAssessment(db, 'ws-1', row.id, event);

    expect(result.scope_conditions).toEqual([]);
    expect(result.response_count).toBe(0);
    expect(result.completed_entity_count).toBe(0);
  });
});
