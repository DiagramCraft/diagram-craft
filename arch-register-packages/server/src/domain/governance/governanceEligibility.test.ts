import { describe, expect, it } from 'vitest';
import type { AuthorizationContext } from '@arch-register/permissions';
import { resolveAssignmentEligibility } from './governanceEligibility';
import type { GovernanceAssignmentDbResult } from './db/governanceDatabase';

const now = new Date('2026-06-01T12:00:00.000Z');

const baseAssignment: GovernanceAssignmentDbResult = {
  id: 'assignment-1',
  case_id: 'case-1',
  workspace: 'ws-1',
  action: 'approve',
  target_type: 'user',
  target_user_id: null,
  target_team_id: null,
  target_team_role: null,
  target_capability: null,
  status: 'open',
  created_at: now,
  resolved_at: null
};

const makeAuthCtx = (overrides: Partial<AuthorizationContext> = {}): AuthorizationContext => ({
  userId: 'user-1',
  globalRoles: new Set(),
  globalPermissions: new Set(),
  workspaceRole: 'editor',
  workspaceRoles: new Map(),
  teamIds: new Set(),
  teamAssignments: [],
  teamRolesByTeam: new Map(),
  teams: [],
  schemas: new Map(),
  entities: new Map(),
  grants: [],
  ...overrides
});

describe('resolveAssignmentEligibility', () => {
  it('is eligible when the assignment targets exactly this user', () => {
    const authCtx = makeAuthCtx();
    const assignment = {
      ...baseAssignment,
      target_type: 'user' as const,
      target_user_id: 'user-1'
    };

    const result = resolveAssignmentEligibility(authCtx, 'user-1', assignment);

    expect(result).toEqual({ eligible: true, authorizationPath: 'assigned_user' });
  });

  it('is not eligible when the assignment targets a different user', () => {
    const authCtx = makeAuthCtx();
    const assignment = {
      ...baseAssignment,
      target_type: 'user' as const,
      target_user_id: 'user-2'
    };

    expect(resolveAssignmentEligibility(authCtx, 'user-1', assignment).eligible).toBe(false);
  });

  it('is eligible when the user holds the required team role for the target team', () => {
    const authCtx = makeAuthCtx({
      teamRolesByTeam: new Map([['team-1', new Set(['team_admin'] as const)]])
    });
    const assignment = {
      ...baseAssignment,
      target_type: 'team_role' as const,
      target_team_id: 'team-1',
      target_team_role: 'team_admin'
    };

    const result = resolveAssignmentEligibility(authCtx, 'user-1', assignment);

    expect(result).toEqual({
      eligible: true,
      authorizationPath: 'team_role:team-1:team_admin'
    });
  });

  it('is not eligible when the user holds a different role on the target team', () => {
    const authCtx = makeAuthCtx({
      teamRolesByTeam: new Map([['team-1', new Set(['team_reviewer'] as const)]])
    });
    const assignment = {
      ...baseAssignment,
      target_type: 'team_role' as const,
      target_team_id: 'team-1',
      target_team_role: 'team_admin'
    };

    expect(resolveAssignmentEligibility(authCtx, 'user-1', assignment).eligible).toBe(false);
  });

  it('is not eligible when the user has no role at all on the target team', () => {
    const authCtx = makeAuthCtx();
    const assignment = {
      ...baseAssignment,
      target_type: 'team_role' as const,
      target_team_id: 'team-1',
      target_team_role: 'team_admin'
    };

    expect(resolveAssignmentEligibility(authCtx, 'user-1', assignment).eligible).toBe(false);
  });

  it('is eligible when the user has the required workspace capability', () => {
    const authCtx = makeAuthCtx({
      workspaceRole: 'owner',
      workspaceRoles: new Map([
        [
          'owner',
          {
            id: 'owner',
            name: 'Owner',
            description: '',
            tone: '',
            builtin: true,
            capabilities: ['ent.approve']
          }
        ]
      ])
    });
    const assignment = {
      ...baseAssignment,
      target_type: 'capability' as const,
      target_capability: 'ent.approve'
    };

    const result = resolveAssignmentEligibility(authCtx, 'user-1', assignment);

    expect(result).toEqual({ eligible: true, authorizationPath: 'capability:ent.approve' });
  });

  it('is not eligible when the user lacks the required workspace capability', () => {
    const authCtx = makeAuthCtx({
      workspaceRole: 'viewer',
      workspaceRoles: new Map([
        [
          'viewer',
          {
            id: 'viewer',
            name: 'Viewer',
            description: '',
            tone: '',
            builtin: true,
            capabilities: []
          }
        ]
      ])
    });
    const assignment = {
      ...baseAssignment,
      target_type: 'capability' as const,
      target_capability: 'ent.approve'
    };

    expect(resolveAssignmentEligibility(authCtx, 'user-1', assignment).eligible).toBe(false);
  });
});
