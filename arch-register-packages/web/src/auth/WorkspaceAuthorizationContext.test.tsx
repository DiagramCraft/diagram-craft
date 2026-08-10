// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthBaseData, User } from './types';
import {
  useWorkspaceAuthorization,
  type WorkspaceAuthorization,
  WorkspaceAuthorizationProvider
} from './WorkspaceAuthorizationContext';

const mocks = vi.hoisted(() => ({
  useAuth: vi.fn(),
  useAuthorizationData: vi.fn()
}));

vi.mock('./AuthContext', () => ({ useAuth: mocks.useAuth }));
vi.mock('./AuthorizationDataContext', () => ({ useAuthorizationData: mocks.useAuthorizationData }));

const user: User = {
  id: 'user-1',
  email: 'user@example.com',
  display_name: 'User One',
  auth_provider: 'local',
  created_at: '2026-01-01T00:00:00.000Z',
  last_login_at: null,
  color: null
};

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
      { id: 'team-2', name: 'Security', type: 'team' },
      { id: 'team-3', name: 'Finance', type: 'team' }
    ]
  }
};

const restrictedFieldGroup = { teamIds: ['team-1'] };

const Probe = ({
  workspaceId,
  resultRef
}: {
  workspaceId: string | null | undefined;
  resultRef: { current: WorkspaceAuthorization | null };
}) => {
  resultRef.current = useWorkspaceAuthorization(workspaceId);
  return null;
};

describe('WorkspaceAuthorizationProvider', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (
      globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT?: boolean }
    ).IS_REACT_ACT_ENVIRONMENT = true;
    mocks.useAuth.mockReturnValue({ user });
    mocks.useAuthorizationData.mockReturnValue(authorizationData);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.clearAllMocks();
  });

  it('shares normalized contexts and evaluator instances across consumers', () => {
    const firstRef = { current: null as WorkspaceAuthorization | null };
    const secondRef = { current: null as WorkspaceAuthorization | null };

    act(() => {
      root.render(
        <WorkspaceAuthorizationProvider>
          <Probe workspaceId="workspace-1" resultRef={firstRef} />
          <Probe workspaceId="workspace-1" resultRef={secondRef} />
        </WorkspaceAuthorizationProvider>
      );
    });

    const first = firstRef.current!;
    const second = secondRef.current!;

    expect(first.context).toBe(second.context);
    expect(first.checker).toBe(second.checker);
    expect(first.capabilities).toBe(second.capabilities);
    expect(first.context?.userId).toBe('user-1');
    expect(first.context?.workspaceRole).toBe('catalog-editor');
    expect(first.context?.teamRolesByTeam.get('team-1')).toEqual(new Set(['team_admin']));
  });

  it('evaluates workspace, global, ownership, and field-group permissions from the shared context', () => {
    const resultRef = { current: null as WorkspaceAuthorization | null };

    act(() => {
      root.render(
        <WorkspaceAuthorizationProvider>
          <Probe workspaceId="workspace-1" resultRef={resultRef} />
        </WorkspaceAuthorizationProvider>
      );
    });

    const result = resultRef.current!;
    expect(result.canViewSchemas).toBe(true);
    expect(result.canViewArtifactContent).toBe(false);
    expect(result.canManageGlobalRoles).toBe(true);
    expect(result.hasGlobalPermission('manage_workspace_roles')).toBe(true);
    expect(result.canCreateProject('team-1')).toBe(true);
    expect(result.canCreateProject(null)).toBe(false);
    expect(result.canCreateTopLevelEntity(null)).toBe(true);
    expect(result.canCreateProjects).toBe(true);
    expect(result.canCreateEntities).toBe(true);
    expect(result.getFieldGroupAccess({ teamIds: ['team-1'] })).toBe('edit');
    expect(result.getFieldGroupAccess({ teamIds: ['team-2'] })).toBe('view');
    expect(result.getFieldGroupAccess({ teamIds: ['team-3'] })).toBe('none');
    expect(result.getFieldGroupAccess(undefined)).toBe('edit');
  });

  it('keeps global checks available without a selected workspace while denying workspace checks', () => {
    const resultRef = { current: null as WorkspaceAuthorization | null };

    act(() => {
      root.render(
        <WorkspaceAuthorizationProvider>
          <Probe workspaceId={null} resultRef={resultRef} />
        </WorkspaceAuthorizationProvider>
      );
    });

    const result = resultRef.current!;
    expect(result.context?.workspaceRole).toBeNull();
    expect(result.context?.teamAssignments).toEqual([]);
    expect(result.hasGlobalPermission('manage_workspace_roles')).toBe(true);
    expect(result.canCreateProject('team-1')).toBe(false);
    expect(result.canCreateTopLevelEntity(null)).toBe(false);
  });

  it('fails closed when authorization data is unavailable, preserving the field-group fallback', () => {
    mocks.useAuth.mockReturnValue({ user: null });
    mocks.useAuthorizationData.mockReturnValue(null);
    const resultRef = { current: null as WorkspaceAuthorization | null };

    act(() => {
      root.render(
        <WorkspaceAuthorizationProvider>
          <Probe workspaceId="workspace-1" resultRef={resultRef} />
        </WorkspaceAuthorizationProvider>
      );
    });

    const result = resultRef.current!;
    expect(result.context).toBeNull();
    expect(result.hasGlobalPermission('manage_workspace_roles')).toBe(false);
    expect(result.canCreateProject(null)).toBe(false);
    expect(result.canCreateTopLevelEntity(null)).toBe(false);
    expect(result.getFieldGroupAccess(restrictedFieldGroup)).toBe('edit');
  });

  it('invalidates the context cache when authorization data changes', () => {
    let currentAuthorizationData: AuthBaseData | null = authorizationData;
    mocks.useAuthorizationData.mockImplementation(() => currentAuthorizationData);
    const resultRef = { current: null as WorkspaceAuthorization | null };

    act(() => {
      root.render(
        <WorkspaceAuthorizationProvider>
          <Probe workspaceId="workspace-1" resultRef={resultRef} />
        </WorkspaceAuthorizationProvider>
      );
    });

    const previousContext = resultRef.current!.context;
    currentAuthorizationData = {
      ...authorizationData,
      global_roles: [],
      global_permissions: [],
      workspace_roles: {},
      workspace_role_definitions_by_workspace: {},
      team_assignments_by_workspace: {},
      teams_by_workspace: {}
    };

    act(() => {
      root.render(
        <WorkspaceAuthorizationProvider>
          <Probe workspaceId="workspace-1" resultRef={resultRef} />
        </WorkspaceAuthorizationProvider>
      );
    });

    expect(resultRef.current!.context).not.toBe(previousContext);
    expect(resultRef.current!.canManageGlobalRoles).toBe(false);
    expect(resultRef.current!.canViewSchemas).toBe(false);
  });
});
