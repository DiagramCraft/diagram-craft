import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { ProjectMilestoneDbResult } from './db/projectDatabase';
import { createMilestone, deleteMilestone } from './projectMilestoneOperations';
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

const makeMilestone = (
  overrides: Partial<ProjectMilestoneDbResult> = {}
): ProjectMilestoneDbResult => ({
  id: 'ms-1',
  workspace: 'ws-1',
  project_id: 'proj-1',
  name: 'Q3 platform migration',
  target_date: '2030-07-01',
  status: 'planned',
  sort_order: 0,
  created_at: now,
  updated_at: now,
  ...overrides
});

const event = { context: { user: { id: 'user-1' } } } as unknown as AuthenticatedEvent;

const makeDb = (milestone: ProjectMilestoneDbResult): DatabaseAdapter =>
  ({
    project: {
      getProject: vi.fn(async () => ({ id: 'proj-1', owner: null })),
      getMilestone: vi.fn(async () => milestone),
      createMilestone: vi.fn(async () => milestone),
      deleteMilestone: vi.fn(async () => milestone)
    },
    catalog: {
      reassignSnapshotsFromMilestone: vi.fn(async () => {})
    }
  }) as unknown as DatabaseAdapter;

describe('createMilestone', () => {
  it('creates a milestone and logs the audit entry', async () => {
    const milestone = makeMilestone();
    const db = makeDb(milestone);

    const result = await createMilestone(
      db,
      'ws-1',
      'proj-1',
      { name: 'Q3 platform migration', target_date: '2030-07-01' },
      event
    );

    expect(result.id).toBe('ms-1');
    expect(db.project.createMilestone).toHaveBeenCalledTimes(1);
    expect(logAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ operation: 'create', entityType: 'project_milestone' })
    );
  });
});

describe('deleteMilestone', () => {
  it('backfills linked snapshots off the milestone before deleting it', async () => {
    const milestone = makeMilestone({ target_date: '2030-07-01' });
    const db = makeDb(milestone);

    const result = await deleteMilestone(db, 'ws-1', 'proj-1', 'ms-1', event);

    expect(result.success).toBe(true);
    expect(db.catalog.reassignSnapshotsFromMilestone).toHaveBeenCalledWith(
      'ws-1',
      'ms-1',
      '2030-07-01'
    );
    expect(db.project.deleteMilestone).toHaveBeenCalledWith('ws-1', 'proj-1', 'ms-1');

    // Backfill must run before the milestone row itself is removed.
    const reassignOrder = (db.catalog.reassignSnapshotsFromMilestone as ReturnType<typeof vi.fn>)
      .mock.invocationCallOrder[0]!;
    const deleteOrder = (db.project.deleteMilestone as ReturnType<typeof vi.fn>).mock
      .invocationCallOrder[0]!;
    expect(reassignOrder).toBeLessThan(deleteOrder);

    expect(logAudit).toHaveBeenCalledWith(
      db,
      expect.objectContaining({ operation: 'delete', entityType: 'project_milestone' })
    );
  });

  it('throws a 404 when the milestone does not exist', async () => {
    const db = makeDb(makeMilestone());
    db.project.getMilestone = vi.fn(async () => null);

    await expect(deleteMilestone(db, 'ws-1', 'proj-1', 'missing', event)).rejects.toMatchObject({
      status: 404
    });
    expect(db.catalog.reassignSnapshotsFromMilestone).not.toHaveBeenCalled();
    expect(db.project.deleteMilestone).not.toHaveBeenCalled();
  });
});
