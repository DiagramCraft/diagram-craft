import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import type { AssessmentDbResult } from './db/projectDatabase';
import { listAssessments } from './assessmentOperations';

vi.mock('../auth/authorization', () => ({
  buildApiAuthCtx: vi.fn(async () => ({})),
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

const now = new Date('2026-06-01T12:00:00.000Z');

const assessment = (id: string, projectId: string): AssessmentDbResult => ({
  id,
  workspace: 'ws-1',
  project_id: projectId,
  name: id,
  description: '',
  status: 'open',
  scope: [],
  scope_conditions: [],
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
