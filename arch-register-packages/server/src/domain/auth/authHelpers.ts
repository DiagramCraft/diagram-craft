import {
  getGlobalPermissionsForRoles,
  resolveWorkspaceRoleDefinitions
} from '@arch-register/permissions';
import type { TeamRole } from '@arch-register/permissions';
import { httpAssert } from '../../utils/httpAssert';
import { verifyPassword } from '../../utils/password';
import { GlobalRole, UserDbResult } from './db/authDatabase';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$Px/0E4/Uidg2/8aJ6c08zA$bYyBAz45tuMYV2oXsOeQzlXH1WMNAApkAxtr8wR9pJo';

type RefreshBody = {
  refresh_token?: string;
};

type UserUpdateBody = {
  color?: unknown;
  display_name?: unknown;
};

type WorkspaceMembershipData = {
  workspace_id: string;
  team_assignments: Array<{ team_id: string; role: TeamRole }>;
  teams: Array<{ id: string; name: string; type: 'team' }>;
  workspace_role: string | null;
  workspace_roles: ReturnType<typeof resolveWorkspaceRoleDefinitions>;
};

/**
 * Selects the refresh token to use for a token-refresh request.
 *
 * **Primary source (browser flow):** the `ar_refresh_token` httpOnly cookie.
 * The cookie is set automatically by the server after login and is not readable
 * by JavaScript, which is the preferred and most secure path.
 *
 * **Fallback (non-browser / API clients):** `refresh_token` field in the JSON
 * request body. This exists to support scripted or server-side API consumers
 * that cannot use cookies. It should never be used from a browser context, as
 * it exposes the token to JavaScript and undermines the httpOnly protection.
 */
export const selectRefreshToken = (cookieToken: string | null | undefined, body?: RefreshBody) =>
  cookieToken ?? body?.refresh_token;

export const verifyLoginPassword = async (
  user: UserDbResult | null,
  password: string
): Promise<boolean> => {
  if (!user?.password_hash || user.auth_provider !== 'local') {
    await verifyPassword(DUMMY_PASSWORD_HASH, password);
    return false;
  }
  return verifyPassword(user.password_hash, password);
};

export const buildAuthMeResponse = (
  user: UserDbResult,
  globalRoles: GlobalRole[],
  workspaceData: WorkspaceMembershipData[]
) => {
  const teamAssignmentsByWorkspace = Object.fromEntries(
    workspaceData
      .filter(ws => ws.team_assignments.length > 0)
      .map(ws => [ws.workspace_id, ws.team_assignments])
  );
  const workspaceRoles = Object.fromEntries(
    workspaceData
      .filter((ws): ws is typeof ws & { workspace_role: string } => ws.workspace_role != null)
      .map(ws => [ws.workspace_id, ws.workspace_role])
  );
  const teamsByWorkspace = Object.fromEntries(workspaceData.map(ws => [ws.workspace_id, ws.teams]));
  const workspaceRoleDefinitionsByWorkspace = Object.fromEntries(
    workspaceData.map(ws => [ws.workspace_id, ws.workspace_roles])
  );

  return {
    id: user.id,
    user_id: user.user_id,
    email: user.email,
    display_name: user.display_name,
    auth_provider: user.auth_provider,
    color: user.color,
    created_at: user.created_at.toISOString(),
    last_login_at: user.last_login_at?.toISOString() ?? null,
    global_roles: globalRoles,
    global_permissions: [...getGlobalPermissionsForRoles(globalRoles)],
    team_assignments_by_workspace: teamAssignmentsByWorkspace,
    workspace_roles: workspaceRoles,
    workspace_role_definitions_by_workspace: workspaceRoleDefinitionsByWorkspace,
    teams_by_workspace: teamsByWorkspace
  };
};

export const buildUserUpdateInput = (body: UserUpdateBody, updatedAt: Date) => {
  if (body.color !== undefined && body.color !== null) {
    httpAssert.string(body.color, { message: 'color must be a string if provided' });
  }
  if (body.display_name !== undefined) {
    httpAssert.string(body.display_name, { message: 'display_name must be a string if provided' });
  }

  return {
    display_name: body.display_name as string | undefined,
    color: (body.color as string | null | undefined) ?? null,
    updated_at: updatedAt
  };
};

export const parseRequestedGlobalRoles = (requestedRoles: unknown[]) => {
  const roles = requestedRoles.filter(
    (role): role is GlobalRole =>
      typeof role === 'string' && ['global_admin', 'workspace_admin'].includes(role)
  );
  httpAssert.true(roles.length === requestedRoles.length, {
    message: 'roles contains invalid values'
  });
  return roles;
};
