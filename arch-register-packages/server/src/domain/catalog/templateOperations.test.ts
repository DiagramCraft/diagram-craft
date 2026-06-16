import { describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import { createFromTemplate } from './templateOperations';

const now = new Date('2026-06-16T12:00:00.000Z');

const makeAuthContext = (teamIds: string[]) =>
  buildAuthorizationContext({
    userId: 'user-1',
    globalRoles: [],
    workspaceRole: null,
    teamAssignments: teamIds.map(teamId => ({ teamId, role: 'team_admin' as const })),
    schemas: [],
    entities: [],
    grants: []
  });

describe('createFromTemplate', () => {
  it('rejects cloning from a template project the caller cannot access', async () => {
    const getContentNodeByPath = vi.fn();
    const db = {
      project: {
        getProject: vi.fn(async (_ws: string, id: string) => {
          if (id === 'dest-project') {
            return {
              id,
              workspace: 'ws-1',
              name: 'Destination',
              description: '',
              owner: 'team-dest',
              status: 'active',
              color: null,
              target_date: null,
              pinned: false,
              owner_name: null,
              created_at: now,
              updated_at: now
            };
          }
          return {
            id,
            workspace: 'ws-1',
            name: 'Source',
            description: '',
            owner: 'team-source',
            status: 'active',
            color: null,
            target_date: null,
            pinned: false,
            owner_name: null,
            created_at: now,
            updated_at: now
          };
        }),
        getContentNodeByPath,
        upsertContentNode: vi.fn(),
        updateContentNodeDerivedData: vi.fn()
      }
    } as unknown as DatabaseAdapter;

    await expect(
      createFromTemplate(
        db,
        { read: vi.fn(), write: vi.fn() },
        'ws-1',
        'dest-project',
        'New Diagram',
        'source-project',
        'templates/source.json',
        null,
        makeAuthContext(['team-dest'])
      )
    ).rejects.toMatchObject({ status: 403 });

    expect(getContentNodeByPath).not.toHaveBeenCalled();
  });

  it('rejects cloning from a file that is not marked as a template', async () => {
    const storage = { read: vi.fn(), write: vi.fn() };
    const db = {
      project: {
        getProject: vi.fn(async (_ws: string, id: string) => ({
          id,
          workspace: 'ws-1',
          name: id,
          description: '',
          owner: id === 'dest-project' ? 'team-dest' : 'team-source',
          status: 'active',
          color: null,
          target_date: null,
          pinned: false,
          owner_name: null,
          created_at: now,
          updated_at: now
        })),
        getContentNodeByPath: vi.fn(async () => ({
          id: 'file-1',
          workspace: 'ws-1',
          project_id: 'source-project',
          entity_id: null,
          parent_id: null,
          path: 'templates/source.json',
          name: 'Source',
          type: 'diagram',
          size_bytes: 10,
          comment_count: 0,
          unresolved_comment_count: 0,
          is_template: false,
          is_workspace_template: false,
          preview_svg: null,
          created_at: now,
          updated_at: now,
          created_by: null,
          updated_by: null,
          mime_type: null,
          original_filename: null
        })),
        upsertContentNode: vi.fn(),
        updateContentNodeDerivedData: vi.fn()
      }
    } as unknown as DatabaseAdapter;

    await expect(
      createFromTemplate(
        db,
        storage,
        'ws-1',
        'dest-project',
        'New Diagram',
        'source-project',
        'templates/source.json',
        null,
        makeAuthContext(['team-dest', 'team-source'])
      )
    ).rejects.toMatchObject({ status: 403 });

    expect(storage.read).not.toHaveBeenCalled();
  });
});
