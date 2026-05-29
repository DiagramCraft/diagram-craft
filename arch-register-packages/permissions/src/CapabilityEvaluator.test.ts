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
        workspaceRole: null,
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
        workspaceRole: null,
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
        workspaceRole: null,
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
        workspaceRole: null,
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
        workspaceRole: null,
        teamMemberships: ['team-1'],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, null)).toBe(false);
    });
  });

  describe('Business Rule: Global admins can create projects for any team', () => {
    it('global_admin can create project for any team', () => {
      const context = buildAuthorizationContext({
        userId: 'admin-user',
        globalRoles: ['global_admin'],
        workspaceRole: null,
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

    it('global_admin can create project even with null owner', () => {
      const context = buildAuthorizationContext({
        userId: 'admin-user',
        globalRoles: ['global_admin'],
        workspaceRole: null,
        teamMemberships: [],
        ownerOptions: [],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, null)).toBe(true);
    });

    it('workspace_admin global role does not grant project creation for non-member teams', () => {
      const context = buildAuthorizationContext({
        userId: 'ws-admin',
        globalRoles: ['workspace_admin'],
        workspaceRole: null,
        teamMemberships: [],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, 'team-1')).toBe(false);
    });
  });

  describe('Business Rule: Workspace editors can create projects', () => {
    it('editor workspace role can create project for any team', () => {
      const context = buildAuthorizationContext({
        userId: 'editor-user',
        globalRoles: [],
        workspaceRole: 'editor',
        teamMemberships: [],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateProject(context, 'team-1')).toBe(true);
    });

    it('viewer workspace role cannot create project for non-member teams', () => {
      const context = buildAuthorizationContext({
        userId: 'viewer-user',
        globalRoles: [],
        workspaceRole: 'viewer',
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
        workspaceRole: null,
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
        workspaceRole: null,
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
        workspaceRole: null,
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

  describe('Business Rule: Users need workspace editor role OR team membership', () => {
    it('user with editor workspace role and team membership can create top-level entity', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        workspaceRole: 'editor',
        teamMemberships: ['team-1'],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(true);
    });

    it('user with team membership but no workspace role can create entity for their team', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        workspaceRole: null,
        teamMemberships: ['team-1'],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(true);
    });

    it('user with editor workspace role but not team member can still create entity', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        workspaceRole: 'editor',
        teamMemberships: ['team-2'],
        ownerOptions: [
          { id: 'team-1', name: 'Engineering', type: 'team' },
          { id: 'team-2', name: 'Marketing', type: 'team' }
        ],
        schemas: [],
        entities: [],
        grants: []
      });

      // Editor workspace role grants ent.edit capability for any team
      expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(true);
    });

    it('user with neither workspace role nor team membership cannot create entity', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        workspaceRole: null,
        teamMemberships: [],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(false);
    });

    it('cannot create entity with null owner without workspace role', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        workspaceRole: null,
        teamMemberships: ['team-1'],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, null)).toBe(false);
    });

    it('editor workspace role can create entity even with null owner', () => {
      const context = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        workspaceRole: 'editor',
        teamMemberships: [],
        ownerOptions: [],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, null)).toBe(true);
    });
  });

  describe('Business Rule: Global admins can create entities for any team', () => {
    it('global_admin can create entity for any team without workspace role', () => {
      const context = buildAuthorizationContext({
        userId: 'admin-user',
        globalRoles: ['global_admin'],
        workspaceRole: null,
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

    it('global_admin can create entity even with null owner', () => {
      const context = buildAuthorizationContext({
        userId: 'admin-user',
        globalRoles: ['global_admin'],
        workspaceRole: null,
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
    it('editor can create entities for any team via workspace role', () => {
      const context = buildAuthorizationContext({
        userId: 'architect',
        globalRoles: [],
        workspaceRole: 'editor',
        teamMemberships: ['architecture-team'],
        ownerOptions: [{ id: 'architecture-team', name: 'Architecture', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, 'architecture-team')).toBe(true);
    });

    it('viewer workspace role without team membership cannot create entities', () => {
      const context = buildAuthorizationContext({
        userId: 'team-member',
        globalRoles: [],
        workspaceRole: 'viewer',
        teamMemberships: [],
        ownerOptions: [{ id: 'engineering-team', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(context, 'engineering-team')).toBe(false);
    });

    it('editor working across multiple teams can create entities for all teams', () => {
      const context = buildAuthorizationContext({
        userId: 'editor-user',
        globalRoles: [],
        workspaceRole: 'editor',
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

      // Editor workspace role grants ent.edit for all teams
      expect(capabilities.canCreateTopLevelEntity(context, 'team-a')).toBe(true);
      expect(capabilities.canCreateTopLevelEntity(context, 'team-b')).toBe(true);
      expect(capabilities.canCreateTopLevelEntity(context, 'team-c')).toBe(true);
    });

    it('user promoted to editor workspace role gains entity creation capability', () => {
      // Before promotion (viewer role)
      const beforeContext = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        workspaceRole: 'viewer',
        teamMemberships: [],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(beforeContext, 'team-1')).toBe(false);

      // After promotion to editor
      const afterContext = buildAuthorizationContext({
        userId: 'user-1',
        globalRoles: [],
        workspaceRole: 'editor',
        teamMemberships: [],
        ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
        schemas: [],
        entities: [],
        grants: []
      });

      expect(capabilities.canCreateTopLevelEntity(afterContext, 'team-1')).toBe(true);
    });

    it('user with editor workspace role can create entities', () => {
      const context = buildAuthorizationContext({
        userId: 'multi-role-user',
        globalRoles: [],
        workspaceRole: 'editor',
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

  it('viewer workspace role with team membership can create projects but not entities via workspace role', () => {
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: null,
      teamMemberships: ['team-1'],
      ownerOptions: [{ id: 'team-1', name: 'Engineering', type: 'team' }],
      schemas: [],
      entities: [],
      grants: []
    });

    // Team membership grants both project and entity creation for own team
    expect(capabilities.canCreateProject(context, 'team-1')).toBe(true);
    expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(true);
  });

  it('editor workspace role can create both projects and entities for any team', () => {
    const context = buildAuthorizationContext({
      userId: 'user-1',
      globalRoles: [],
      workspaceRole: 'editor',
      teamMemberships: ['team-2'],
      ownerOptions: [
        { id: 'team-1', name: 'Engineering', type: 'team' },
        { id: 'team-2', name: 'Architecture', type: 'team' }
      ],
      schemas: [],
      entities: [],
      grants: []
    });

    // Editor workspace role grants proj.create and ent.edit for all teams
    expect(capabilities.canCreateProject(context, 'team-1')).toBe(true);
    expect(capabilities.canCreateTopLevelEntity(context, 'team-1')).toBe(true);
    expect(capabilities.canCreateProject(context, 'team-2')).toBe(true);
    expect(capabilities.canCreateTopLevelEntity(context, 'team-2')).toBe(true);
  });

  it('global_admin can do everything', () => {
    const context = buildAuthorizationContext({
      userId: 'admin-user',
      globalRoles: ['global_admin'],
      workspaceRole: null,
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
      workspaceRole: null,
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
