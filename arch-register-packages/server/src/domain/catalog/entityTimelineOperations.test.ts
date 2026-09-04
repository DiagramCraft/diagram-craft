import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import { getTimelineViewData } from './entityTimelineOperations';

vi.mock('../operation', () => ({
  runAuthorizedOperation: vi.fn(
    async (options: {
      operation: (context: { ws: string; authCtx: unknown }) => Promise<unknown>;
    }) => options.operation({ ws: 'ws-1', authCtx: {} })
  )
}));

vi.mock('../auth/authorization', () => ({
  canAccessProject: vi.fn((_context: unknown, owner: string | null) => owner === 'visible-team')
}));

vi.mock('@arch-register/permissions', () => ({
  PermissionChecker: class {
    hasEntityPermission() {
      return true;
    }
  }
}));

const timelineChange = (projectId: string) => ({
  changeCase: {
    id: 'case-' + projectId,
    workspace: 'ws-1',
    project_id: projectId,
    status: 'planned',
    name: 'Planned change',
    description: null,
    effective_date: '2026-10-01',
    milestone_id: null,
    created_at: new Date('2026-01-01T00:00:00Z'),
    updated_at: new Date('2026-01-01T00:00:00Z')
  },
  member: {
    id: 'member-' + projectId,
    entity_id: 'entity-1',
    base_version: 1,
    applied_version_id: null
  },
  revisionMessage: null
});

describe('getTimelineViewData', () => {
  it('removes project changes from projects the caller cannot access', async () => {
    const db = {
      catalog: {
        listEntities: vi.fn(async () => [{ id: 'entity-1' }]),
        listEntityVersionsByIds: vi.fn(async () => [])
      },
      changeCase: {
        listTimelineMembersByEntities: vi.fn(async () => [
          timelineChange('visible-project'),
          timelineChange('hidden-project')
        ])
      },
      project: {
        projects: {
          listProjects: vi.fn(async () => [
            { id: 'visible-project', owner: 'visible-team' },
            { id: 'hidden-project', owner: 'hidden-team' }
          ])
        }
      }
    } as unknown as DatabaseAdapter;

    const result = await getTimelineViewData(db, 'default', ['entity-1'], {} as never);

    expect(result['entity-1']?.projectChanges.map(change => change.changeCase.project_id)).toEqual([
      'visible-project'
    ]);
  });
});
