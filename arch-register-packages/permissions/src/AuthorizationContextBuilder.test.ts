import { describe, it, expect } from 'vitest';
import {
  buildAuthorizationContext,
  fetchAuthorizationContextData
} from './AuthorizationContextBuilder.js';
import type {
  PermissionDataProvider,
  AuthorizationContextData
} from './AuthorizationContextBuilder.js';
import type {
  Entity,
  EntitySchema,
  EntityGrant,
  GlobalRole,
  WorkspaceOwnerOption
} from './types.js';

describe('AuthorizationContextBuilder - buildAuthorizationContext', () => {
  it('builds context with all required fields', () => {
    const data: AuthorizationContextData = {
      userId: 'user-1',
      globalRoles: ['workspace_admin'],
      workspaceRole: null,
      teamMemberships: ['team-1', 'team-2'],
      ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
      schemas: [],
      entities: [],
      grants: []
    };

    const context = buildAuthorizationContext(data);

    expect(context.userId).toBe('user-1');
    expect(context.globalRoles).toEqual(new Set(['workspace_admin']));
    expect(context.teamIds).toEqual(new Set(['team-1', 'team-2']));
    expect(context.ownerOptions).toEqual([{ id: 'team-1', name: 'Engineering', type: 'team' }]);
    expect(context.schemas).toBeInstanceOf(Map);
    expect(context.entities).toBeInstanceOf(Map);
    expect(context.grants).toEqual([]);
  });

  it('derives global permissions from global roles', () => {
    const data: AuthorizationContextData = {
      userId: 'user-1',
      globalRoles: ['workspace_admin'],
      workspaceRole: null,
      teamMemberships: [],
      ownerOptions: [],
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
      teamMemberships: [],
      ownerOptions: [],
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
      teamMemberships: [],
      ownerOptions: [],
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
      teamMemberships: [],
      ownerOptions: [],
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
      teamMemberships: [],
      ownerOptions: [],
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
      teamMemberships: [],
      ownerOptions: [],
      schemas: [],
      entities: [],
      grants: []
    };

    const context = buildAuthorizationContext(data);

    expect(context.globalRoles.size).toBe(0);
    expect(context.globalPermissions.size).toBe(0);
    expect(context.teamIds.size).toBe(0);
    expect(context.ownerOptions).toEqual([]);
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
    private teamMemberships: Map<string, string[]> = new Map();
    private globalRoles: Map<string, GlobalRole[]> = new Map();
    private ownerOptions: Map<string, WorkspaceOwnerOption[]> = new Map();

    setEntities(entities: Entity[]) {
      this.entities = entities;
    }

    setSchemas(schemas: EntitySchema[]) {
      this.schemas = schemas;
    }

    setGrants(grants: EntityGrant[]) {
      this.grants = grants;
    }

    setTeamMemberships(workspaceId: string, userId: string, teams: string[]) {
      this.teamMemberships.set(`${workspaceId}:${userId}`, teams);
    }

    setGlobalRoles(userId: string, roles: GlobalRole[]) {
      this.globalRoles.set(userId, roles);
    }

    setOwnerOptions(workspaceId: string, options: WorkspaceOwnerOption[]) {
      this.ownerOptions.set(workspaceId, options);
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

    async getTeamMemberships(workspaceId: string, userId: string): Promise<string[]> {
      return this.teamMemberships.get(`${workspaceId}:${userId}`) ?? [];
    }

    async getGlobalRoles(userId: string): Promise<GlobalRole[]> {
      return this.globalRoles.get(userId) ?? [];
    }

    async getOwnerOptions(workspaceId: string): Promise<WorkspaceOwnerOption[]> {
      return this.ownerOptions.get(workspaceId) ?? [];
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
      role: 'viewer',
      applies_to: 'self',
      created_at: new Date()
    };

    provider.setSchemas([schema]);
    provider.setEntities([entity]);
    provider.setGrants([grant]);
    provider.setTeamMemberships('workspace-1', 'user-1', ['team-1']);
    provider.setGlobalRoles('user-1', ['workspace_admin']);
    provider.setOwnerOptions('workspace-1', [{ id: 'team-1', name: 'Engineering', type: 'team' }]);

    const data = await fetchAuthorizationContextData(provider, 'workspace-1', 'user-1');

    expect(data.userId).toBe('user-1');
    expect(data.globalRoles).toEqual(['workspace_admin']);
    expect(data.teamMemberships).toEqual(['team-1']);
    expect(data.ownerOptions).toEqual([{ id: 'team-1', name: 'Engineering', type: 'team' }]);
    expect(data.schemas).toEqual([schema]);
    expect(data.entities).toEqual([entity]);
    expect(data.grants).toEqual([grant]);
  });

  it('handles empty data from provider', async () => {
    const provider = new TestDataProvider();

    const data = await fetchAuthorizationContextData(provider, 'workspace-1', 'user-1');

    expect(data.userId).toBe('user-1');
    expect(data.globalRoles).toEqual([]);
    expect(data.teamMemberships).toEqual([]);
    expect(data.ownerOptions).toEqual([]);
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
    const originalGetTeamMemberships = provider.getTeamMemberships.bind(provider);
    const originalGetGlobalRoles = provider.getGlobalRoles.bind(provider);
    const originalGetOwnerOptions = provider.getOwnerOptions.bind(provider);
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

    provider.getTeamMemberships = async (workspaceId: string, userId: string) => {
      callOrder.push('teamMemberships');
      return originalGetTeamMemberships(workspaceId, userId);
    };

    provider.getGlobalRoles = async (userId: string) => {
      callOrder.push('globalRoles');
      return originalGetGlobalRoles(userId);
    };

    provider.getOwnerOptions = async (workspaceId: string) => {
      callOrder.push('ownerOptions');
      return originalGetOwnerOptions(workspaceId);
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
    expect(callOrder).toContain('teamMemberships');
    expect(callOrder).toContain('globalRoles');
    expect(callOrder).toContain('ownerOptions');
    expect(callOrder).toContain('workspaceRole');
    expect(callOrder.length).toBe(7);
  });

  it('can be used to build authorization context', async () => {
    const provider = new TestDataProvider();
    provider.setGlobalRoles('user-1', ['workspace_admin']);
    provider.setTeamMemberships('workspace-1', 'user-1', ['team-1']);
    provider.setOwnerOptions('workspace-1', [{ id: 'team-1', name: 'Engineering', type: 'team' }]);

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
          role: 'viewer',
          applies_to: 'self',
          created_at: new Date('2024-01-01')
        }
      ];
    }

    async getTeamMemberships(_workspaceId: string, userId: string): Promise<string[]> {
      // Simulate user being in multiple teams
      if (userId === 'engineer-1') {
        return ['team-engineering', 'team-operations'];
      }
      return [];
    }

    async getGlobalRoles(userId: string): Promise<GlobalRole[]> {
      if (userId === 'architect-1') {
        return ['workspace_admin'];
      }
      return [];
    }

    async getOwnerOptions(_workspaceId: string): Promise<WorkspaceOwnerOption[]> {
      return [
        { id: 'team-engineering', name: 'Engineering', type: 'team' },
        { id: 'team-operations', name: 'Operations', type: 'team' }
      ];
    }

    async getWorkspaceRole(_workspaceId: string, _userId: string) {
      return null;
    }
  }

  it('builds complete context for engineer with team memberships', async () => {
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
