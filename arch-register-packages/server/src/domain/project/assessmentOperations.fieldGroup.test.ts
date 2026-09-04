import { describe, expect, it, vi } from 'vitest';
import {
  buildAuthorizationContext,
  type WorkspaceAuthorizationContext
} from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type {
  CreateAssessmentRequest,
  UpdateAssessmentRequest
} from '@arch-register/api-types/assessmentContract';
import type { AssessmentDbResult } from './db/projectDatabase';
import { buildApiAuthCtx, requireProjectAction } from '../auth/authorization';
import { createAssessment, updateAssessment } from './assessmentOperations';

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(),
  canAccessProject: vi.fn(() => true),
  requireProjectAccess: vi.fn(),
  requireProjectAction: vi.fn()
}));

vi.mock('../workspace/resolveWorkspace', () => ({
  resolveWorkspace: vi.fn(async () => 'ws-1')
}));

vi.mock('../audit/db/auditLogging', () => ({
  logAudit: vi.fn(async () => {}),
  extractEntityFields: (value: Record<string, unknown>) => value,
  computeChanges: () => ({})
}));

const now = new Date('2026-06-01T12:00:00.000Z');
const condition = { fieldId: 'secret', op: 'equals', value: 'classified' } as const;
const unknownCondition = { fieldId: 'removed-field', op: 'equals', value: 'classified' } as const;
const schema = {
  id: 'schema-service',
  fields: [{ id: 'secret', groupId: 'restricted' }],
  groups: [{ id: 'restricted', accessControl: { teamIds: ['team-security'] } }]
} as never;

const makeAuthContext = (
  access: 'none' | 'view' | 'edit' | 'admin'
): WorkspaceAuthorizationContext =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: access === 'admin' ? ['global_admin'] : [],
    workspaceRole: null,
    workspaceCapabilityCeiling: access === 'admin' ? undefined : ['content.view'],
    teamAssignments:
      access === 'view'
        ? [{ teamId: 'team-security', role: 'team_reviewer' }]
        : access === 'edit'
          ? [{ teamId: 'team-security', role: 'team_editor' }]
          : [],
    schemas: [],
    entities: [],
    grants: []
  });

const makeAssessment = (
  scopeConditions: AssessmentDbResult['scope_conditions'] = []
): AssessmentDbResult => ({
  id: 'assessment-1',
  workspace: 'ws-1',
  project_id: 'project-1',
  name: 'Security Readiness',
  description: '',
  status: 'draft',
  mode: 'fields',
  scope: ['schema-service'],
  scope_conditions: scopeConditions,
  fields: [],
  groups: [],
  assigned_team_ids: [],
  due_at: null,
  recurrence: { type: 'none' },
  response_window_days: null,
  current_occurrence: 1,
  pending_occurrence_job_run_id: null,
  next_occurrence_at: null,
  created_at: now,
  updated_at: now
});

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

const makeDb = (existing = makeAssessment()) => {
  const project = { id: 'project-1', owner: 'team-project' };
  const db = {
    project: {
      projects: {
        getProject: vi.fn(async () => project)
      },
      assessments: {
        getAssessmentById: vi.fn(async () => existing),
        createAssessment: vi.fn(async (input: AssessmentDbResult) => input),
        updateAssessment: vi.fn(
          async (_ws: string, _projectId: string, _id: string, input: AssessmentDbResult) => ({
            ...existing,
            ...input
          })
        )
      },
      assessmentResponses: {
        listAllAssessmentResponses: vi.fn(async () => []),
        updateAssessmentResponseDerivedFields: vi.fn(async () => undefined),
        listAssessmentResponses: vi.fn(async () => [])
      }
    },
    catalog: {
      listSchemas: vi.fn(async () => [schema]),
      listEntitiesPaginated: vi.fn(async () => [])
    },
    governance: { listCases: vi.fn(async () => []) },
    core: {
      transaction: vi.fn((callback: (tx: DatabaseAdapter) => Promise<unknown>) =>
        callback(db as unknown as DatabaseAdapter)
      )
    }
  } as unknown as DatabaseAdapter;
  return db;
};

const setAuthContext = (context: WorkspaceAuthorizationContext) => {
  vi.mocked(buildApiAuthCtx).mockResolvedValue(context);
  vi.mocked(requireProjectAction).mockImplementation(() => undefined);
};

const createBody = {
  project_id: 'project-1',
  name: 'Security Readiness',
  scope: ['schema-service'],
  scope_conditions: [condition]
} as CreateAssessmentRequest;

const updateBody = {
  project_id: 'project-1',
  name: 'Security Readiness',
  scope: ['schema-service'],
  scope_conditions: [condition]
} as UpdateAssessmentRequest;

describe('assessment scope condition operations', () => {
  it.each([
    ['no-view', 'none', false],
    ['view-only', 'view', true],
    ['field-group editor', 'edit', true],
    ['authorized admin', 'admin', true]
  ] as const)('%s create access is enforced', async (_label, access, allowed) => {
    setAuthContext(makeAuthContext(access));
    const db = makeDb();

    const result = createAssessment(db, 'ws-1', createBody, event);

    if (allowed) await expect(result).resolves.toMatchObject({ scope_conditions: [condition] });
    else await expect(result).rejects.toMatchObject({ status: 403 });
    expect(db.project.assessments.createAssessment).toHaveBeenCalledTimes(allowed ? 1 : 0);
  });

  it.each([
    ['no-view', 'none', false],
    ['view-only', 'view', true],
    ['field-group editor', 'edit', true],
    ['authorized admin', 'admin', true]
  ] as const)('%s update access is enforced', async (_label, access, allowed) => {
    setAuthContext(makeAuthContext(access));
    const db = makeDb();

    const result = updateAssessment(db, 'ws-1', 'assessment-1', updateBody, event);

    if (allowed) await expect(result).resolves.toMatchObject({ scope_conditions: [condition] });
    else await expect(result).rejects.toMatchObject({ status: 403 });
    expect(db.project.assessments.updateAssessment).toHaveBeenCalledTimes(allowed ? 1 : 0);
  });

  it('rejects unknown condition fields on create and update', async () => {
    setAuthContext(makeAuthContext('admin'));
    const db = makeDb();

    await expect(
      createAssessment(db, 'ws-1', { ...createBody, scope_conditions: [unknownCondition] }, event)
    ).rejects.toMatchObject({ status: 403 });
    await expect(
      updateAssessment(
        db,
        'ws-1',
        'assessment-1',
        { ...updateBody, scope_conditions: [unknownCondition] },
        event
      )
    ).rejects.toMatchObject({ status: 403 });
    expect(db.project.assessments.createAssessment).not.toHaveBeenCalled();
    expect(db.project.assessments.updateAssessment).not.toHaveBeenCalled();
  });
});
