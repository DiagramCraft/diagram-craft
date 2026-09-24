import { describe, expect, it } from 'vitest';
import type { AuthBaseData } from './types';
import { createWorkspaceContextResolver } from './WorkspaceAuthorizationContext';

const authorizationData: AuthBaseData = {
  global_roles: ['workspace_admin'],
  global_permissions: ['create_workspaces', 'manage_workspace_roles'],
  workspace_roles: { 'workspace-1': 'catalog-editor' },
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
    'workspace-1': [{ team_id: 'team-1', role: 'team_admin' }]
  },
  teams_by_workspace: {
    'workspace-1': [{ id: 'team-1', name: 'Platform', type: 'team' }]
  }
};

describe('createWorkspaceContextResolver', () => {
  it('caches the normalized context per workspace id', () => {
    const getContext = createWorkspaceContextResolver('user-1', authorizationData);
    const first = getContext('workspace-1');
    const second = getContext('workspace-1');
    expect(first).not.toBeNull();
    expect(first).toBe(second);
  });

  it('builds a separate cached instance per workspace id', () => {
    const getContext = createWorkspaceContextResolver('user-1', authorizationData);
    const workspace1 = getContext('workspace-1');
    const workspace2 = getContext('workspace-2');
    expect(workspace1).not.toBe(workspace2);
  });

  it('normalizes a null/undefined workspace id to the same cache key', () => {
    const getContext = createWorkspaceContextResolver('user-1', authorizationData);
    const withNull = getContext(null);
    const withUndefined = getContext(undefined);
    expect(withNull).toBe(withUndefined);
  });

  it('a fresh resolver (new authorizationData snapshot) does not reuse the old cache', () => {
    const first = createWorkspaceContextResolver('user-1', authorizationData);
    const second = createWorkspaceContextResolver('user-1', { ...authorizationData });
    expect(first('workspace-1')).not.toBe(second('workspace-1'));
  });

  it('fails closed (returns null for every workspace id) with no user', () => {
    const getContext = createWorkspaceContextResolver(null, authorizationData);
    expect(getContext('workspace-1')).toBeNull();
  });

  it('fails closed (returns null for every workspace id) with no authorization data', () => {
    const getContext = createWorkspaceContextResolver('user-1', null);
    expect(getContext('workspace-1')).toBeNull();
  });
});
