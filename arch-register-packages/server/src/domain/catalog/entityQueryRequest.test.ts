import { buildAuthorizationContext } from '@arch-register/permissions';
import { describe, expect, it, vi } from 'vitest';
import type { DatabaseAdapter } from '../../db/database';
import type { EntityListQueryParams } from './entityQuery';
import { prepareEntityQueryRequest } from './entityQueryRequest';

const workspace = 'ws-1';

const globalAdminAuthCtx = buildAuthorizationContext({
  userId: 'user-1',
  globalRoles: ['global_admin'],
  workspaceRole: null,
  teamAssignments: [],
  teams: [],
  schemas: [],
  entities: [],
  grants: []
});

const noProjectAccessAuthCtx = buildAuthorizationContext({
  userId: 'user-1',
  globalRoles: [],
  workspaceRole: null,
  teamAssignments: [],
  teams: [],
  schemas: [],
  entities: [],
  grants: []
});

const makeDb = (options?: { collection?: unknown; project?: unknown }) => {
  const getCollection = vi.fn().mockResolvedValue(options?.collection ?? null);
  const getProject = vi.fn().mockResolvedValue(options?.project ?? null);
  const db = {
    view: { getCollection },
    project: {
      projects: {
        getProject
      }
    }
  } as unknown as DatabaseAdapter;
  return { db, getCollection, getProject };
};

describe('prepareEntityQueryRequest', () => {
  it('returns the normalized execution query and validated context', async () => {
    const collection = { id: 'collection-1' };
    const project = { id: 'project-1', owner: null };
    const { db, getCollection, getProject } = makeDb({ collection, project });

    const result = await prepareEntityQueryRequest(db, workspace, globalAdminAuthCtx, {
      _schemaId: 'schema-1',
      collectionId: 'collection-1',
      projectId: 'project-1',
      q: 'search'
    });

    expect(result.collection).toBe(collection);
    expect(result.project).toBe(project);
    expect(result.query.entityQuery).toEqual(
      expect.objectContaining({
        schemaId: 'schema-1',
        projectId: 'project-1'
      })
    );
    expect(getCollection).toHaveBeenCalledWith('user-1', workspace, 'collection-1');
    expect(getProject).toHaveBeenCalledWith(workspace, 'project-1');
  });

  it('rejects conflicting legacy and structured fields before resolving context', async () => {
    const { db, getCollection, getProject } = makeDb();
    const input = {
      _schemaId: 'schema-legacy',
      entityQuery: {
        schemaId: 'schema-structured',
        root: { kind: 'and', children: [] }
      }
    } as EntityListQueryParams;

    await expect(
      prepareEntityQueryRequest(db, workspace, globalAdminAuthCtx, input)
    ).rejects.toMatchObject({
      status: 400,
      message: 'EntityQuery conflicts with request field(s): _schemaId'
    });
    expect(getCollection).not.toHaveBeenCalled();
    expect(getProject).not.toHaveBeenCalled();
  });

  it('returns 404 when a supported endpoint references a missing collection', async () => {
    const { db } = makeDb();

    await expect(
      prepareEntityQueryRequest(db, workspace, globalAdminAuthCtx, {
        collectionId: 'missing-collection'
      })
    ).rejects.toMatchObject({ status: 404, message: 'Collection not found' });
  });

  it('rejects collections for tree preparation without looking them up', async () => {
    const { db, getCollection } = makeDb();

    await expect(
      prepareEntityQueryRequest(
        db,
        workspace,
        globalAdminAuthCtx,
        { collectionId: 'collection-1' },
        { collectionPolicy: 'reject' }
      )
    ).rejects.toMatchObject({
      status: 400,
      message: 'Collections support table and cards views only'
    });
    expect(getCollection).not.toHaveBeenCalled();
  });

  it('resolves missing projects and enforces project access', async () => {
    const missingProject = makeDb();
    await expect(
      prepareEntityQueryRequest(missingProject.db, workspace, globalAdminAuthCtx, {
        projectId: 'missing-project'
      })
    ).rejects.toMatchObject({ status: 404, message: "Project 'missing-project' not found" });

    const { db } = makeDb({ project: { id: 'project-1', owner: 'team-1' } });
    await expect(
      prepareEntityQueryRequest(db, workspace, noProjectAccessAuthCtx, {
        projectId: 'project-1'
      })
    ).rejects.toMatchObject({ status: 403 });
  });
});
