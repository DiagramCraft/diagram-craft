import { describe, it, expect } from 'vitest';
import { CapabilityEvaluator } from './CapabilityEvaluator.js';
import { buildAuthorizationContext } from './AuthorizationContextBuilder.js';

describe('CapabilityEvaluator - Project Creation', () => {
  const capabilities = new CapabilityEvaluator();

  describe('Business Rule: Users can create projects for teams they belong to', () => {
    it('team member can create project for their team', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        teamMemberships: ['team-1'],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, 'team-1')).toBe(true);
    });

    it('user cannot create project for team they do not belong to', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        teamMemberships: ['team-1'],
        ownerOptions: [
          { id: 'team-1', name: 'Engineering', type: 'team' },
          { id: 'team-2', name: 'Marketing', type: 'team' }
        ],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, 'team-2')).toBe(false);
    });

    it('user in multiple teams can create projects for any of their teams', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        teamMemberships: ['team-1', 'team-2', 'team-3'],
        ownerOptions: [
          { id: 'team-1', name: 'Engineering', type: 'team' },
          { id: 'team-2', name: 'Marketing', type: 'team' },
          { id: 'team-3', name: 'Sales', type: 'team' }
        ],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, 'team-1')).toBe(true);
      expect(capabilities.canCreateProject(context, 'team-2')).toBe(true);
      expect(capabilities.canCreateProject(context, 'team-3')).toBe(true);
    });

    it('user with no team memberships cannot create projects', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        teamMemberships: [],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, 'team-1')).toBe(false);
    });

    it('cannot create project with null owner (no team)', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        teamMemberships: ['team-1'],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, null)).toBe(false);
    });
  });

  describe('Business Rule: Platform admins can create projects for any team', () => {
    it('platform_admin can create project for any team', () => {
      const context = buildAuthorizationContext({
        userId: 'admin-user',
        globalRoles: ['platform_admin'],
        teamMemberships: [],
        ownerOptions: [
          { id: 'team-1', name: 'Engineering', type: 'team' },
          { id: 'team-2', name: 'Marketing', type: 'team' }
        ],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, 'team-1')).toBe(true);
      expect(capabilities.canCreateProject(context, 'team-2')).toBe(true);
    });

    it('platform_admin can create project even with null owner', () => {
      const context = buildAuthorizationContext({
        userId: 'admin-user',
        globalRoles: ['platform_admin'],
        teamMemberships: [],
        ownerOptions: [],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, null)).toBe(true);
    });

    it('other global roles do not grant project creation for non-member teams', () => {
      const context = buildAuthorizationContext({
        userId: 'schema-admin',
        globalRoles: ['schema_admin'],
        teamMemberships: [],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, 'team-1')).toBe(false);
    });
  });

  describe('Real-world scenarios', () => {
    it('new employee joins team and can immediately create projects', () => {
      const context = buildAuthorizationContext({
        userId: 'new-employee',
        globalRoles: [],
        teamMemberships: ['engineering-team'],
        ownerOptions: [{ id: 'engineering-team', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, 'engineering-team')).toBe(true);
    });

    it('employee leaves team and can no longer create projects for that team', () => {
      const context = buildAuthorizationContext({
        userId: 'former-employee',
        globalRoles: [],
        teamMemberships: [], // Removed from team
        ownerOptions: [{ id: 'engineering-team', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, 'engineering-team')).toBe(false);
    });

    it('contractor working with multiple client teams', () => {
      const context = buildAuthorizationContext({
        userId: 'contractor',
        globalRoles: [],
        teamMemberships: ['client-a-team', 'client-b-team'],
        ownerOptions: [
          { id: 'client-a-team', name: 'Client A', type: 'team' },
          { id: 'client-b-team', name: 'Client B', type: 'team' },
          { id: 'client-c-team', name: 'Client C', type: 'team' }
        ],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, 'client-a-team')).toBe(true);
      expect(capabilities.canCreateProject(context, 'client-b-team')).toBe(true);
      expect(capabilities.canCreateProject(context, 'client-c-team')).toBe(false);
    });
  });
});

describe('CapabilityEvaluator - Top-Level Entity Creation', () => {
  const capabilities = new CapabilityEvaluator();

  describe('Business Rule: Users need schema access AND team membership', () => {
    it('user with view_schema and team membership can create top-level entity', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: ['schema_admin'],
        teamMemberships: ['team-1'],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(true);
    });

    it('user with team membership but no schema access cannot create entity', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        teamMemberships: ['team-1'],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(false);
    });

    it('user with schema access but not team member cannot create entity', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: ['schema_admin'],
        teamMemberships: ['team-2'],
        ownerOptions: [
          { id: 'team-1', name: 'Engineering', type: 'team' },
          { id: 'team-2', name: 'Marketing', type: 'team' }
        ],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(false);
    });

    it('user with neither schema access nor team membership cannot create entity', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        teamMemberships: [],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(false);
    });

    it('cannot create entity with null owner even with schema access', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: ['schema_admin'],
        teamMemberships: ['team-1'],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, null)).toBe(false);
    });
  });

  describe('Business Rule: Platform admins can create entities for any team', () => {
    it('platform_admin can create entity for any team without schema_admin role', () => {
      const context = buildAuthorizationContext({
        userId: 'admin-user',
        globalRoles: ['platform_admin'],
        teamMemberships: [],
        ownerOptions: [
          { id: 'team-1', name: 'Engineering', type: 'team' },
          { id: 'team-2', name: 'Marketing', type: 'team' }
        ],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(true);
      expect(capabilities.canCreateTopLevelEntity(context, 'team-2')).toBe(true);
    });

    it('platform_admin can create entity even with null owner', () => {
      const context = buildAuthorizationContext({
        userId: 'admin-user',
        globalRoles: ['platform_admin'],
        teamMemberships: [],
        ownerOptions: [],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, null)).toBe(true);
    });
  });

  describe('Real-world scenarios', () => {
    it('architect with schema access can create entities for their team', () => {
      const context = buildAuthorizationContext({
        userId: 'architect',
        globalRoles: ['schema_admin'],
        teamMemberships: ['architecture-team'],
        ownerOptions: [{ id: 'architecture-team', name: 'Architecture', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, 'architecture-team')).toBe(true);
    });

    it('regular team member without schema knowledge cannot create entities', () => {
      const context = buildAuthorizationContext({
        userId: 'team-member',
        globalRoles: [],
        teamMemberships: ['engineering-team'],
        ownerOptions: [{ id: 'engineering-team', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, 'engineering-team')).toBe(false);
    });

    it('schema admin working across multiple teams', () => {
      const context = buildAuthorizationContext({
        userId: 'schema-admin',
        globalRoles: ['schema_admin'],
        teamMemberships: ['team-a', 'team-b'],
        ownerOptions: [
          { id: 'team-a', name: 'Team A', type: 'team' },
          { id: 'team-b', name: 'Team B', type: 'team' },
          { id: 'team-c', name: 'Team C', type: 'team' }
        ],
        schemas: [],
        entities: [],
        grants: []
      });

      // Can create for teams they're members of
      expect(capabilities.canCreateTopLevelEntity(context, 'team-a')).toBe(true);
      expect(capabilities.canCreateTopLevelEntity(context, 'team-b')).toBe(true);
      
      // Cannot create for teams they're not members of
      expect(capabilities.canCreateTopLevelEntity(context, 'team-c')).toBe(false);
    });

    it('user promoted to schema_admin gains entity creation capability', () => {
      // Before promotion
      const beforeContext = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        teamMemberships: ['team-1'],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(beforeContext, 'team-1')).toBe(false);

      // After promotion
      const afterContext = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: ['schema_admin'],
        teamMemberships: ['team-1'],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(afterContext, 'team-1')).toBe(true);
    });

    it('user with multiple roles including schema_admin can create entities', () => {
      const context = buildAuthorizationContext({
        userId: 'multi-role-user',
        globalRoles: ['schema_admin', 'auditor'],
        teamMemberships: ['team-1'],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(true);
    });
  });
});

describe('CapabilityEvaluator - Combined Scenarios', () => {
  const capabilities = new CapabilityEvaluator();

  it('user can create projects but not entities (no schema access)', () => {
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      teamMemberships: ['team-1'],
      ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(capabilities.canCreateProject(context, 'team-1')).toBe(true);
    expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(false);
  });

  it('user can create entities but not projects (schema access but not team member)', () => {
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: ['schema_admin'],
      teamMemberships: ['team-2'],
      ownerOptions: [
        { id: 'team-1', name: 'Engineering', type: 'team' },
        { id: 'team-2', name: 'Architecture', type: 'team' }
      ],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(capabilities.canCreateProject(context, 'team-1')).toBe(false);
    expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(false);
    expect(capabilities.canCreateProject(context, 'team-2')).toBe(true);
    expect(capabilities.canCreateTopLevelEntity(context, 'team-2')).toBe(true);
  });

  it('platform_admin can do everything', () => {
    const context = buildAuthorizationContext({
      userId: 'admin-user',
      globalRoles: ['platform_admin'],
      teamMemberships: [],
      ownerOptions: [
        { id: 'team-1', name: 'Engineering', type: 'team' },
        { id: 'team-2', name: 'Marketing', type: 'team' }
      ],
      schemas: [],
      entities: [],
      grants: []
    });

    // Can create projects for any team
    expect(capabilities.canCreateProject(context, 'team-1')).toBe(true);
    expect(capabilities.canCreateProject(context, 'team-2')).toBe(true);
    expect(capabilities.canCreateProject(context, null)).toBe(true);

    // Can create entities for any team
    expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(true);
    expect(capabilities.canCreateTopLevelEntity(context, 'team-2')).toBe(true);
    expect(capabilities.canCreateTopLevelEntity(context, null)).toBe(true);
  });

  it('regular user with no special access cannot create anything', () => {
    const context = buildAuthorizationContext({
      userId: 'regular-user',
      globalRoles: [],
      teamMemberships: [],
      ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
      schemas: [],
      entities: [],
      grants: []
    });

    expect(capabilities.canCreateProject(context, 'team-1')).toBe(false);
    expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(false);
  });
});
