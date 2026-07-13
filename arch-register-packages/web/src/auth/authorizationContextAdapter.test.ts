import { describe, expect, it } from 'vitest';
import { CapabilityEvaluator, PermissionChecker } from '@arch-register/permissions';
import type { AuthBaseData } from './types';
import { buildWorkspaceAuthorizationContextFromAuthData } from './authorizationContextAdapter';

const authorizationData: AuthBaseData = {
  global_roles: ['workspace_admin'],
  global_permissions: ['create_workspaces', 'manage_workspace_roles'],
  workspace_roles: {
    'workspace-1': 'catalog-editor'
  },
  workspace_role_definitions_by_workspace: {
    'workspace-1': [
      {
        id: 'catalog-editor',
        name: 'Catalog editor',
        description: 'Can edit projects and entities',
        tone: 'blue',
        builtin: false,
        capabilities: ['ws.view', 'proj.edit', 'ent.edit']
      }
    ]
  },
  team_assignments_by_workspace: {
    'workspace-1': [
      { team_id: 'team-1', role: 'team_admin' },
      { team_id: 'team-2', role: 'team_reviewer' }
    ]
  },
  teams_by_workspace: {
    'workspace-1': [
      { id: 'team-1', name: 'Platform', type: 'team' },
      { id: 'team-2', name: 'Security', type: 'team' }
    ]
  }
};

describe('buildWorkspaceAuthorizationContextFromAuthData', () => {
  it('adapts user, role, team assignment, and team data for a workspace', () => {
    const context = buildWorkspaceAuthorizationContextFromAuthData(
      'user-1',
      authorizationData,
      'workspace-1'
    );

    expect(context.userId).toBe('user-1');
    expect(context.globalRoles).toEqual(new Set(['workspace_admin']));
    expect(context.workspaceRole).toBe('catalog-editor');
    expect(context.workspaceRoles.get('catalog-editor')?.capabilities).toEqual([
      'ws.view',
      'proj.edit',
      'ent.edit'
    ]);
    expect(context.teamAssignments).toEqual([
      { teamId: 'team-1', role: 'team_admin' },
      { teamId: 'team-2', role: 'team_reviewer' }
    ]);
    expect(context.teamRolesByTeam.get('team-1')).toEqual(new Set(['team_admin']));
    expect(context.teams).toEqual(authorizationData.teams_by_workspace?.['workspace-1']);
  });

  it('supports workspace, global, project, and owner-based capability checks', () => {
    const context = buildWorkspaceAuthorizationContextFromAuthData(
      'user-1',
      authorizationData,
      'workspace-1'
    );
    const checker = new PermissionChecker();
    const capabilities = new CapabilityEvaluator();

    expect(checker.hasWorkspaceCapability(context, 'ws.view')).toBe(true);
    expect(checker.hasGlobalPermission(context, 'manage_workspace_roles')).toBe(true);
    expect(checker.hasProjectPermission(context, 'team-1', 'delete_project')).toBe(true);
    expect(capabilities.canCreateProject(context, 'team-1')).toBe(true);
    expect(capabilities.canCreateTopLevelEntity(context, null)).toBe(true);
  });

  it('keeps global roles but omits workspace-specific assignments when no workspace is selected', () => {
    const context = buildWorkspaceAuthorizationContextFromAuthData(
      'user-1',
      authorizationData,
      null
    );

    expect(context.globalRoles).toEqual(new Set(['workspace_admin']));
    expect(context.workspaceRole).toBeNull();
    expect(context.workspaceRoles.has('owner')).toBe(true);
    expect(context.teamAssignments).toEqual([]);
    expect(context.teams).toEqual([]);
  });
});
