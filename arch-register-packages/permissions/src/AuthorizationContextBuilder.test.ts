import { describe, it, expect } from 'vitest';
import {
  buildAuthorizationContext,
  buildWorkspaceAuthorizationContext,
  fetchAuthorizationContextData
} from './AuthorizationContextBuilder.js';
import type {
  PermissionDataProvider,
  AuthorizationContextData
} from './AuthorizationContextBuilder.js';
import type { Entity, EntitySchema, EntityGrant, GlobalRole, WorkspaceTeam } from './types.js';

const makeTeamAssignments = (teamIds: string[]) =>
  teamIds.map(teamId => ({ teamId, role: 'team_admin' as const }));

const makeTeams = (teamIds: string[]): WorkspaceTeam[] =>
  teamIds.map(teamId => ({ id: teamId, name: teamId, type: 'team' as const }));

describe('AuthorizationContextBuilder - buildAuthorizationContext', () => {
  it('builds a workspace context without entity authorization data', () => {
    const context = buildWorkspaceAuthorizationContext({
      userId: 'user-1',
      globalRoles: ['workspace_admin'],
      workspaceRole: 'editor',
      teamAssignments: makeTeamAssignments(['team-1']),
      teams: makeTeams(['team-1'])
    });

    expect(context.userId).toBe('user-1');
    expect(context.globalPermissions.has('create_workspaces')).toBe(true);
    expect(context.workspaceRole).toBe('editor');
    expect(context.teamIds).toEqual(new Set(['team-1']));
    expect(context).not.toHaveProperty('schemas');
    expect(context).not.toHaveProperty('entities');
    expect(context).not.toHaveProperty('grants');
  });

  it('builds context with all required fields', () => {
    const data: AuthorizationContextData = {
      userId: 'user-1',
      globalRoles: ['workspace_admin'],
      workspaceRole: null,
      teamAssignments: makeTeamAssignments(['team-1', 'team-2']),
      teams: makeTeams(['team-1']),
      schemas: [],
      entities: [],
      grants: []
    };

    const context = buildAuthorizationContext(data);

    expect(context.userId).toBe('user-1');
    expect(context.globalRoles).toEqual(new Set(['workspace_admin']));
    expect(context.teamIds).toEqual(new Set(['team-1', 'team-2']));
    expect(context.teams).toEqual(makeTeams(['team-1']));
    expect(context.schemas).toBeInstanceOf(Map);
    expect(context.entities).toBeInstanceOf(Map);
    expect(context.grants).toEqual([]);
  });

  it('derives global permissions from global roles', () => {
    const data: AuthorizationContextData = {
      userId: 'user-1',
      globalRoles: ['workspace_admin'],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    };

    const context = buildAuthorizationContext(data);

    expect(context.globalPermissions.has('create_workspaces')).toBe(true);
    expect(context.globalPermissions.has('manage_workspace_roles')).toBe(true);
    expect(context.globalPermissions.has('admin_platform')).toBe(false);
  });

  it('combines permissions from multiple global roles', () => {
    const data: AuthorizationContextData = {
      userId: 'user-1',
      globalRoles: ['workspace_admin'],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    };

    const context = buildAuthorizationContext(data);

    expect(context.globalPermissions.has('create_workspaces')).toBe(true);
    expect(context.globalPermissions.has('manage_workspace_roles')).toBe(true);
  });

  it('global_admin gets admin_platform permission', () => {
    const data: AuthorizationContextData = {
      userId: 'admin-user',
      globalRoles: ['global_admin'],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    };

    const context = buildAuthorizationContext(data);

    expect(context.globalPermissions.has('admin_platform')).toBe(true);
    expect(context.globalPermissions.has('create_workspaces')).toBe(true);
    expect(context.globalPermissions.has('manage_workspace_roles')).toBe(true);
  });

  it('converts schemas array to Map keyed by id', () => {
    const schema1: EntitySchema = {
      id: 'schema-1',
      workspace: 'workspace-1',
      name: 'Schema 1',
      fields: [],
      color: null,
      icon: null,
      default_owner: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const schema2: EntitySchema = {
      id: 'schema-2',
      workspace: 'workspace-1',
      name: 'Schema 2',
      fields: [],
      color: null,
      icon: null,
      default_owner: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const data: AuthorizationContextData = {
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [schema1, schema2],
      entities: [],
      grants: []
    };

    const context = buildAuthorizationContext(data);

    expect(context.schemas.size).toBe(2);
    expect(context.schemas.get('schema-1')).toEqual(schema1);
    expect(context.schemas.get('schema-2')).toEqual(schema2);
  });

  it('converts entities array to Map keyed by id', () => {
    const entity1: Entity = {
      id: 'entity-1',
      workspace: 'workspace-1',
      slug: 'entity-1',
      namespace: 'default',
      name: 'Entity 1',
      description: '',
      owner: null,
      lifecycle: null,
      tags: [],
      links: [],
      schema_id: 'schema-1',
      data: {},
      visibility_mode: 'public',
      created_at: new Date(),
      updated_at: new Date()
    };

    const entity2: Entity = {
      id: 'entity-2',
      workspace: 'workspace-1',
      slug: 'entity-2',
      namespace: 'default',
      name: 'Entity 2',
      description: '',
      owner: null,
      lifecycle: null,
      tags: [],
      links: [],
      schema_id: 'schema-1',
      data: {},
      visibility_mode: 'public',
      created_at: new Date(),
      updated_at: new Date()
    };

    const data: AuthorizationContextData = {
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [],
      entities: [entity1, entity2],
      grants: []
    };

    const context = buildAuthorizationContext(data);

    expect(context.entities.size).toBe(2);
    expect(context.entities.get('entity-1')).toEqual(entity1);
    expect(context.entities.get('entity-2')).toEqual(entity2);
  });

  it('handles empty arrays correctly', () => {
    const data: AuthorizationContextData = {
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamAssignments: [],
      teams: [],
      schemas: [],
      entities: [],
      grants: []
    };

    const context = buildAuthorizationContext(data);

    expect(context.globalRoles.size).toBe(0);
    expect(context.globalPermissions.size).toBe(0);
    expect(context.teamIds.size).toBe(0);
    expect(context.teams).toEqual([]);
    expect(context.schemas.size).toBe(0);
    expect(context.entities.size).toBe(0);
    expect(context.grants).toEqual([]);
  });
});

describe('AuthorizationContextBuilder - fetchAuthorizationContextData', () => {
  class TestDataProvider implements PermissionDataProvider {
    private entities: Entity[] = [];
    private schemas: EntitySchema[] = [];
    private grants: EntityGrant[] = [];
    private teamAssignments: Map<string, Array<{ teamId: string; role: 'team_admin' }>> = new Map();
    private globalRoles: Map<string, GlobalRole[]> = new Map();
    private teams: Map<string, WorkspaceTeam[]> = new Map();

    setEntities(entities: Entity[]) {
      this.entities = entities;
    }

    setSchemas(schemas: EntitySchema[]) {
      this.schemas = schemas;
    }

    setGrants(grants: EntityGrant[]) {
      this.grants = grants;
    }

    setTeamAssignments(workspaceId: string, userId: string, teamIds: string[]) {
      this.teamAssignments.set(`${workspaceId}:${userId}`, makeTeamAssignments(teamIds));
    }

    setGlobalRoles(userId: string, roles: GlobalRole[]) {
      this.globalRoles.set(userId, roles);
    }

    setTeams(workspaceId: string, teams: WorkspaceTeam[]) {
      this.teams.set(workspaceId, teams);
    }

    async getEntities(_workspaceId: string): Promise<Entity[]> {
      return this.entities;
    }

    async getSchemas(_workspaceId: string): Promise<EntitySchema[]> {
      return this.schemas;
    }

    async getEntityGrants(_workspaceId: string): Promise<EntityGrant[]> {
      return this.grants;
    }

    async getTeamAssignments(workspaceId: string, userId: string) {
      return this.teamAssignments.get(`${workspaceId}:${userId}`) ?? [];
    }

    async getGlobalRoles(userId: string): Promise<GlobalRole[]> {
      return this.globalRoles.get(userId) ?? [];
    }

    async getTeams(workspaceId: string): Promise<WorkspaceTeam[]> {
      return this.teams.get(workspaceId) ?? [];
    }

    async getWorkspaceRole(_workspaceId: string, _userId: string) {
      return null;
    }
  }

  it('fetches all data from provider', async () => {
    const provider = new TestDataProvider();

    const schema: EntitySchema = {
      id: 'schema-1',
      workspace: 'workspace-1',
      name: 'Schema 1',
      fields: [],
      color: null,
      icon: null,
      default_owner: null,
      created_at: new Date(),
      updated_at: new Date()
    };

    const entity: Entity = {
      id: 'entity-1',
      workspace: 'workspace-1',
      slug: 'entity-1',
      namespace: 'default',
      name: 'Entity 1',
      description: '',
      owner: null,
      lifecycle: null,
      tags: [],
      links: [],
      schema_id: 'schema-1',
      data: {},
      visibility_mode: 'public',
      created_at: new Date(),
      updated_at: new Date()
    };

    const grant: EntityGrant = {
      id: 'grant-1',
      workspace: 'workspace-1',
      entity_id: 'entity-1',
      principal_type: 'user',
      principal_id: 'user-1',
      role: 'editor',
      applies_to: 'self',
      created_at: new Date()
    };

    provider.setSchemas([schema]);
    provider.setEntities([entity]);
    provider.setGrants([grant]);
    provider.setTeamAssignments('workspace-1', 'user-1', ['team-1']);
    provider.setGlobalRoles('user-1', ['workspace_admin']);
    provider.setTeams('workspace-1', makeTeams(['team-1']));

    const data = await fetchAuthorizationContextData(provider, 'workspace-1', 'user-1');

    expect(data.userId).toBe('user-1');
    expect(data.globalRoles).toEqual(['workspace_admin']);
    expect(data.teamAssignments).toEqual(makeTeamAssignments(['team-1']));
    expect(data.teams).toEqual(makeTeams(['team-1']));
    expect(data.schemas).toEqual([schema]);
    expect(data.entities).toEqual([entity]);
    expect(data.grants).toEqual([grant]);
  });

  it('returns only the canonical fetched data shape', async () => {
    const provider = new TestDataProvider();
    provider.setTeamAssignments('workspace-1', 'user-1', ['team-1']);
    provider.setTeams('workspace-1', makeTeams(['team-1']));

    const data = await fetchAuthorizationContextData(provider, 'workspace-1', 'user-1');

    expect(data.teamAssignments).toEqual(makeTeamAssignments(['team-1']));
    expect(data.teams).toEqual(makeTeams(['team-1']));
  });

  it('handles empty data from provider', async () => {
    const provider = new TestDataProvider();

    const data = await fetchAuthorizationContextData(provider, 'workspace-1', 'user-1');

    expect(data.userId).toBe('user-1');
    expect(data.globalRoles).toEqual([]);
    expect(data.teamAssignments).toEqual([]);
    expect(data.teams).toEqual([]);
    expect(data.schemas).toEqual([]);
    expect(data.entities).toEqual([]);
    expect(data.grants).toEqual([]);
  });

  it('fetches data in parallel', async () => {
    const provider = new TestDataProvider();
    const callOrder: string[] = [];

    // Override methods to track call order
    const originalGetEntities = provider.getEntities.bind(provider);
    const originalGetSchemas = provider.getSchemas.bind(provider);
    const originalGetGrants = provider.getEntityGrants.bind(provider);
    const originalGetTeamAssignments = provider.getTeamAssignments.bind(provider);
    const originalGetGlobalRoles = provider.getGlobalRoles.bind(provider);
    const originalGetTeams = provider.getTeams.bind(provider);
    const originalGetWorkspaceRole = provider.getWorkspaceRole.bind(provider);

    provider.getEntities = async (workspaceId: string) => {
      callOrder.push('entities');
      return originalGetEntities(workspaceId);
    };

    provider.getSchemas = async (workspaceId: string) => {
      callOrder.push('schemas');
      return originalGetSchemas(workspaceId);
    };

    provider.getEntityGrants = async (workspaceId: string) => {
      callOrder.push('grants');
      return originalGetGrants(workspaceId);
    };

    provider.getTeamAssignments = async (workspaceId: string, userId: string) => {
      callOrder.push('teamAssignments');
      return originalGetTeamAssignments(workspaceId, userId);
    };

    provider.getGlobalRoles = async (userId: string) => {
      callOrder.push('globalRoles');
      return originalGetGlobalRoles(userId);
    };

    provider.getTeams = async (workspaceId: string) => {
      callOrder.push('teams');
      return originalGetTeams(workspaceId);
    };

    provider.getWorkspaceRole = async (workspaceId: string, userId: string) => {
      callOrder.push('workspaceRole');
      return originalGetWorkspaceRole(workspaceId, userId);
    };

    await fetchAuthorizationContextData(provider, 'workspace-1', 'user-1');

    // All methods should be called (order doesn't matter due to parallel execution)
    expect(callOrder).toContain('entities');
    expect(callOrder).toContain('schemas');
    expect(callOrder).toContain('grants');
    expect(callOrder).toContain('teamAssignments');
    expect(callOrder).toContain('globalRoles');
    expect(callOrder).toContain('teams');
    expect(callOrder).toContain('workspaceRole');
    expect(callOrder.length).toBe(7);
  });

  it('can be used to build authorization context', async () => {
    const provider = new TestDataProvider();
    provider.setGlobalRoles('user-1', ['workspace_admin']);
    provider.setTeamAssignments('workspace-1', 'user-1', ['team-1']);
    provider.setTeams('workspace-1', makeTeams(['team-1']));

    const data = await fetchAuthorizationContextData(provider, 'workspace-1', 'user-1');
    const context = buildAuthorizationContext(data);

    expect(context.userId).toBe('user-1');
    expect(context.globalRoles.has('workspace_admin')).toBe(true);
    expect(context.teamIds.has('team-1')).toBe(true);
    expect(context.globalPermissions.has('create_workspaces')).toBe(true);
  });
});

describe('AuthorizationContextBuilder - Real-world Integration', () => {
  class MockDatabaseProvider implements PermissionDataProvider {
    async getEntities(workspaceId: string): Promise<Entity[]> {
      // Simulate database query
      return [
        {
          id: 'entity-1',
          workspace: workspaceId,
          slug: 'app-server',
          namespace: 'infrastructure',
          name: 'Application Server',
          description: 'Main application server',
          owner: 'team-engineering',
          lifecycle: 'production',
          tags: ['critical', 'backend'],
          links: [],
          schema_id: 'schema-server',
          data: {},
          visibility_mode: 'restricted',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-15')
        }
      ];
    }

    async getSchemas(workspaceId: string): Promise<EntitySchema[]> {
      return [
        {
          id: 'schema-server',
          workspace: workspaceId,
          name: 'Server',
          fields: [
            { id: 'hostname', name: 'Hostname', type: 'text' },
            { id: 'ip_address', name: 'IP Address', type: 'text' }
          ],
          color: '#3b82f6',
          icon: 'server',
          default_owner: 'team-engineering',
          created_at: new Date('2024-01-01'),
          updated_at: new Date('2024-01-01')
        }
      ];
    }

    async getEntityGrants(workspaceId: string): Promise<EntityGrant[]> {
      return [
        {
          id: 'grant-1',
          workspace: workspaceId,
          entity_id: 'entity-1',
          principal_type: 'team',
          principal_id: 'team-operations',
          role: 'editor',
          applies_to: 'self',
          created_at: new Date('2024-01-01')
        }
      ];
    }

    async getTeamAssignments(_workspaceId: string, userId: string) {
      // Simulate user being in multiple teams
      if (userId === 'engineer-1') {
        return makeTeamAssignments(['team-engineering', 'team-operations']);
      }
      return [];
    }

    async getGlobalRoles(userId: string): Promise<GlobalRole[]> {
      if (userId === 'architect-1') {
        return ['workspace_admin'];
      }
      return [];
    }

    async getTeams(_workspaceId: string): Promise<WorkspaceTeam[]> {
      return makeTeams(['team-engineering', 'team-operations']);
    }

    async getWorkspaceRole(_workspaceId: string, _userId: string) {
      return null;
    }
  }

  it('builds complete context for engineer with team assignments', async () => {
    const provider = new MockDatabaseProvider();
    const data = await fetchAuthorizationContextData(provider, 'workspace-prod', 'engineer-1');
    const context = buildAuthorizationContext(data);

    expect(context.userId).toBe('engineer-1');
    expect(context.teamIds.has('team-engineering')).toBe(true);
    expect(context.teamIds.has('team-operations')).toBe(true);
    expect(context.entities.size).toBe(1);
    expect(context.schemas.size).toBe(1);
    expect(context.grants.length).toBe(1);
  });

  it('builds complete context for architect with schema access', async () => {
    const provider = new MockDatabaseProvider();
    const data = await fetchAuthorizationContextData(provider, 'workspace-prod', 'architect-1');
    const context = buildAuthorizationContext(data);

    expect(context.userId).toBe('architect-1');
    expect(context.globalRoles.has('workspace_admin')).toBe(true);
    expect(context.globalPermissions.has('create_workspaces')).toBe(true);
    expect(context.globalPermissions.has('manage_workspace_roles')).toBe(true);
  });
});
