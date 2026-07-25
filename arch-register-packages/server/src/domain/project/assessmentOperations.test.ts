import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { AssessmentDbResult } from './db/projectDatabase';
import {
  ASSESSMENT_RESPONSE_CASE_KIND,
  listAssessments,
  updateAssessmentStatus
} from './assessmentOperations';
import type { GovernanceCaseDbResult } from '../governance/db/governanceDatabase';

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
      }
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
      supersedeAllOpenAssignmentsForCase: vi.fn(async () => [] as string[])
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
