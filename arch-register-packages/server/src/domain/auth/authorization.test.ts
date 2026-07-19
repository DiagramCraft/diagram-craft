import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildAuthorizationContext } from '@arch-register/permissions';
import { HTTPError } from 'h3';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { ServerDataProvider } from './ServerAuthorizationDataProvider';
import {
  buildApiAuthCtx,
  buildApiEntityAuthCtx,
  filterVisibleEntities,
  GLOBAL_WS,
  requireSchemaRead
} from './authorization';

const db = {} as DatabaseAdapter;

const makeEvent = (userId = 'user-1') =>
  ({ context: { user: { id: userId } } }) as unknown as AuthenticatedEvent;

const mockDataProvider = () => {
  const getEntities = vi.spyOn(ServerDataProvider.prototype, 'getEntities').mockResolvedValue([]);
  const getSchemas = vi.spyOn(ServerDataProvider.prototype, 'getSchemas').mockResolvedValue([]);
  const getEntityGrants = vi
    .spyOn(ServerDataProvider.prototype, 'getEntityGrants')
    .mockResolvedValue([]);
  const getTeamAssignments = vi
    .spyOn(ServerDataProvider.prototype, 'getTeamAssignments')
    .mockResolvedValue([]);
  const getGlobalRoles = vi
    .spyOn(ServerDataProvider.prototype, 'getGlobalRoles')
    .mockResolvedValue([]);
  const getTeams = vi.spyOn(ServerDataProvider.prototype, 'getTeams').mockResolvedValue([]);
  const getWorkspaceRole = vi
    .spyOn(ServerDataProvider.prototype, 'getWorkspaceRole')
    .mockResolvedValue(null);
  const getWorkspaceRoles = vi
    .spyOn(ServerDataProvider.prototype, 'getWorkspaceRoles')
    .mockResolvedValue([]);

  return {
    getEntities,
    getSchemas,
    getEntityGrants,
    getTeamAssignments,
    getGlobalRoles,
    getTeams,
    getWorkspaceRole,
    getWorkspaceRoles
  };
};

afterEach(() => {
  vi.restoreAllMocks();
});

const now = new Date('2026-06-16T12:00:00.000Z');

const schema = {
  id: 'schema-1',
  workspace: 'ws-1',
  name: 'Application',
  fields: [],
  color: null,
  icon: null,
  default_owner: null,
  created_at: now,
  updated_at: now
};

const publicEntity = {
  id: 'entity-public',
  workspace: 'ws-1',
  slug: 'public-app',
  namespace: 'default',
  name: 'Public App',
  description: '',
  owner: null,
  lifecycle: null,
  tags: [],
  links: [],
  schema_id: 'schema-1',
  data: {},
  visibility_mode: 'public' as const,
  created_at: now,
  updated_at: now
};

const restrictedEntity = {
  ...publicEntity,
  id: 'entity-restricted',
  slug: 'restricted-app',
  name: 'Restricted App',
  visibility_mode: 'restricted' as const
};

describe('authorization helpers', () => {
  it('filters entities to those the caller can view', () => {
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      schemas: [schema],
      entities: [publicEntity, restrictedEntity],
      grants: []
    });

    expect(filterVisibleEntities(context, [publicEntity, restrictedEntity]).map(e => e.id)).toEqual(
      ['entity-public']
    );
  });

  it('requires schema read access via workspace view capability', () => {
    const deniedContext = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      schemas: [],
      entities: [],
      grants: []
    });

    expect(() => requireSchemaRead(deniedContext)).toThrowError(HTTPError);

    const allowedContext = buildAuthorizationContext({
      userId: 'user-2',
      globalRoles: [],
      workspaceRole: 'viewer',
      schemas: [],
      entities: [],
      grants: []
    });

    expect(() => requireSchemaRead(allowedContext)).not.toThrow();
  });
});

describe('buildApiAuthCtx request cache', () => {
  it('reuses a context for repeated calls in the same workspace', async () => {
    const provider = mockDataProvider();
    const event = makeEvent();

    const first = await buildApiAuthCtx(db, 'ws-1', event);
    const second = await buildApiAuthCtx(db, 'ws-1', event);

    expect(second).toBe(first);
    expect(provider.getEntities).not.toHaveBeenCalled();
    expect(provider.getSchemas).not.toHaveBeenCalled();
    expect(provider.getEntityGrants).not.toHaveBeenCalled();
    expect(provider.getTeamAssignments).toHaveBeenCalledTimes(1);
    expect(provider.getGlobalRoles).toHaveBeenCalledTimes(1);
    expect(provider.getTeams).toHaveBeenCalledTimes(1);
    expect(provider.getWorkspaceRole).toHaveBeenCalledTimes(1);
    expect(provider.getWorkspaceRoles).toHaveBeenCalledTimes(1);
  });

  it('shares an in-flight context build across concurrent calls', async () => {
    const provider = mockDataProvider();
    let releaseEntities!: () => void;
    const entitiesReady = new Promise<void>(resolve => {
      releaseEntities = resolve;
    });
    provider.getWorkspaceRole.mockImplementation(async () => {
      await entitiesReady;
      return null;
    });
    const event = makeEvent();

    const firstPromise = buildApiAuthCtx(db, 'ws-1', event);
    const secondPromise = buildApiAuthCtx(db, 'ws-1', event);

    expect(provider.getWorkspaceRole).toHaveBeenCalledTimes(1);
    releaseEntities();

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(second).toBe(first);
  });

  it('keeps contexts separate by workspace and request', async () => {
    const provider = mockDataProvider();
    const firstEvent = makeEvent();
    const secondEvent = makeEvent();

    const first = await buildApiAuthCtx(db, 'ws-1', firstEvent);
    const secondWorkspace = await buildApiAuthCtx(db, 'ws-2', firstEvent);
    const secondRequest = await buildApiAuthCtx(db, 'ws-1', secondEvent);

    expect(secondWorkspace).not.toBe(first);
    expect(secondRequest).not.toBe(first);
    expect(provider.getEntities).not.toHaveBeenCalled();
  });

  it('caches global authorization separately', async () => {
    const provider = mockDataProvider();
    const event = makeEvent();

    const first = await buildApiAuthCtx(db, GLOBAL_WS, event);
    const second = await buildApiAuthCtx(db, GLOBAL_WS, event);

    expect(second).toBe(first);
    expect(provider.getGlobalRoles).toHaveBeenCalledTimes(1);
    expect(provider.getEntities).not.toHaveBeenCalled();
  });

  it('removes a failed context build from the cache', async () => {
    const provider = mockDataProvider();
    const error = new Error('temporary authorization data failure');
    provider.getWorkspaceRole.mockRejectedValueOnce(error);
    const event = makeEvent();

    await expect(buildApiAuthCtx(db, 'ws-1', event)).rejects.toBe(error);
    await expect(buildApiAuthCtx(db, 'ws-1', event)).resolves.toBeDefined();
    expect(provider.getWorkspaceRole).toHaveBeenCalledTimes(2);
  });

  it('loads entity authorization data only for an entity context', async () => {
    const provider = mockDataProvider();
    const event = makeEvent();

    const workspaceContext = await buildApiAuthCtx(db, 'ws-1', event);
    expect(workspaceContext).not.toHaveProperty('entities');
    expect(provider.getEntities).not.toHaveBeenCalled();
    expect(provider.getSchemas).not.toHaveBeenCalled();
    expect(provider.getEntityGrants).not.toHaveBeenCalled();

    const first = await buildApiEntityAuthCtx(db, 'ws-1', event);
    const second = await buildApiEntityAuthCtx(db, 'ws-1', event);

    expect(first).toBe(second);
    expect(first.entities).toBeInstanceOf(Map);
    expect(first.schemas).toBeInstanceOf(Map);
    expect(provider.getEntities).toHaveBeenCalledTimes(1);
    expect(provider.getSchemas).toHaveBeenCalledTimes(1);
    expect(provider.getEntityGrants).toHaveBeenCalledTimes(1);
    expect(provider.getWorkspaceRole).toHaveBeenCalledTimes(1);
  });

  it('shares an in-flight entity context build', async () => {
    const provider = mockDataProvider();
    let releaseEntities!: () => void;
    const entitiesReady = new Promise<void>(resolve => {
      releaseEntities = resolve;
    });
    provider.getEntities.mockImplementation(async () => {
      await entitiesReady;
      return [];
    });
    const event = makeEvent();

    const firstPromise = buildApiEntityAuthCtx(db, 'ws-1', event);
    const secondPromise = buildApiEntityAuthCtx(db, 'ws-1', event);

    await vi.waitFor(() => expect(provider.getEntities).toHaveBeenCalledTimes(1));
    releaseEntities();

    const [first, second] = await Promise.all([firstPromise, secondPromise]);
    expect(second).toBe(first);
  });

  it('preserves API-token capability ceilings when loading entity data', async () => {
    const provider = mockDataProvider();
    const event = makeEvent() as AuthenticatedEvent;
    event.context.apiToken = {
      type: 'api_token',
      id: 'token-1',
      workspace: 'ws-1',
      capabilities: ['ws.view'],
      created_by: 'user-1'
    };

    const context = await buildApiEntityAuthCtx(db, 'ws-1', event);

    expect(context.workspaceCapabilityCeiling).toEqual(new Set(['ws.view']));
    expect(provider.getEntities).toHaveBeenCalledTimes(1);
  });
});
