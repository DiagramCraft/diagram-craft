import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { AssessmentDbResult } from './db/projectDatabase';
import { upsertAssessmentResponse } from './assessmentResponseOperations';
import { logAudit } from '../audit/db/auditLogging';

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => ({
    userId: 'user-1',
    globalPermissions: new Set(['admin_platform']),
    workspaceRole: null,
    workspaceRoles: new Map(),
    teamRolesByTeam: new Map(),
    schemas: new Map(),
    entities: new Map(),
    grants: []
  })),
  requireProjectAction: vi.fn(),
  requireProjectAccess: vi.fn()
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

vi.mock('../audit/db/auditLogging', () => ({
  logAudit: vi.fn(async () => {}),
  extractEntityFields: (o: Record<string, unknown>) => o,
  computeChanges: () => ({})
}));

const now = new Date('2026-06-01T12:00:00.000Z');

const makeAssessment = (
  status: AssessmentDbResult['status'],
  overrides: Partial<AssessmentDbResult> = {}
): AssessmentDbResult => ({
  id: 'asmnt-1',
  workspace: 'ws-1',
  project_id: 'proj-1',
  name: 'Security Readiness',
  description: '',
  status,
  mode: 'fields',
  scope: ['schema-service'],
  scope_conditions: [],
  fields: [{ id: 'f1', label: 'Rating', type: 'rating', requirementLevel: 'required' }],
  groups: [],
  assigned_team_ids: [],
  due_at: null,
  recurrence: { type: 'none' },
  response_window_days: null,
  current_occurrence: 1,
  pending_occurrence_job_run_id: null,
  next_occurrence_at: null,
  created_at: now,
  updated_at: now,
  ...overrides
});

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

const makeDb = (assessment: AssessmentDbResult): DatabaseAdapter =>
  ({
    project: {
      getProject: vi.fn(async () => ({ id: 'proj-1', owner: null })),
      getAssessmentById: vi.fn(async () => assessment),
      getAssessmentResponse: vi.fn(async () => null),
      upsertAssessmentResponse: vi.fn(async () => ({
        id: 'resp-1',
        workspace: 'ws-1',
        assessment_id: 'asmnt-1',
        entity_id: 'entity-1',
        values: { f1: 5 },
        created_at: now,
        updated_at: now,
        updated_by: 'user-1',
        updated_by_name: 'User One'
      }))
    }
  }) as unknown as DatabaseAdapter;

describe('upsertAssessmentResponse', () => {
  it.each([
    'draft',
    'closed',
    'archived'
  ] as const)('rejects with a 409 when the assessment is %s', async status => {
    const db = makeDb(makeAssessment(status));

    await expect(
      upsertAssessmentResponse(db, 'ws-1', 'asmnt-1', 'entity-1', { values: { f1: 5 } }, event)
    ).rejects.toMatchObject({ status: 409 });

    expect(db.project.upsertAssessmentResponse).not.toHaveBeenCalled();
  });

  it('succeeds when the assessment is open', async () => {
    const db = makeDb(makeAssessment('open'));

    const result = await upsertAssessmentResponse(
      db,
      'ws-1',
      'asmnt-1',
      'entity-1',
      { values: { f1: 5 } },
      event
    );

    expect(result.entity_id).toBe('entity-1');
    expect(result.id).toBe('resp-1');
    expect(result.updated_by).toBe('user-1');
    expect(result.updated_by_name).toBe('User One');
    expect(db.project.upsertAssessmentResponse).toHaveBeenCalledTimes(1);
    expect(logAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({
        entityName: 'Security Readiness / entity-1',
        metadata: { subject_entity_id: 'entity-1' }
      })
    );
  });

  it('materializes derived fields before storing a response', async () => {
    const db = makeDb(
      makeAssessment('open', {
        fields: [
          { id: 'f1', label: 'Rating', type: 'rating', requirementLevel: 'required' },
          {
            id: 'f2',
            label: 'Double rating',
            type: 'derived',
            requirementLevel: 'optional',
            expression: 'field("f1") + field("f1")',
            resultType: 'number'
          }
        ]
      })
    );

    await upsertAssessmentResponse(db, 'ws-1', 'asmnt-1', 'entity-1', { values: { f1: 5 } }, event);

    expect(db.project.upsertAssessmentResponse).toHaveBeenCalledWith(
      expect.objectContaining({ values: { f1: 5, f2: 10 } })
    );
  });

  it('rejects direct writes to derived fields', async () => {
    const db = makeDb(
      makeAssessment('open', {
        fields: [
          { id: 'f1', label: 'Rating', type: 'rating', requirementLevel: 'required' },
          {
            id: 'f2',
            label: 'Double rating',
            type: 'derived',
            requirementLevel: 'optional',
            expression: 'field("f1") + field("f1")',
            resultType: 'number'
          }
        ]
      })
    );

    await expect(
      upsertAssessmentResponse(db, 'ws-1', 'asmnt-1', 'entity-1', { values: { f2: 10 } }, event)
    ).rejects.toMatchObject({ status: 400 });
    expect(db.project.upsertAssessmentResponse).not.toHaveBeenCalled();
  });

  it('rejects field values for a confirm-only assessment', async () => {
    const db = makeDb(makeAssessment('open', { mode: 'confirm', fields: [] }));

    await expect(
      upsertAssessmentResponse(db, 'ws-1', 'asmnt-1', 'entity-1', { values: { f1: 5 } }, event)
    ).rejects.toMatchObject({ status: 400 });

    expect(db.project.upsertAssessmentResponse).not.toHaveBeenCalled();
  });

  it('records a confirm action for a confirm-only assessment', async () => {
    const db = makeDb(makeAssessment('open', { mode: 'confirm', fields: [] }));

    const result = await upsertAssessmentResponse(
      db,
      'ws-1',
      'asmnt-1',
      'entity-1',
      { values: {} },
      event
    );

    expect(result.entity_id).toBe('entity-1');
    expect(db.project.upsertAssessmentResponse).toHaveBeenCalledTimes(1);
  });
});
