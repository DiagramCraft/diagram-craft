import type { WorkspaceAuthorizationContext } from './types.js';

export type FieldGroupAccessControl = { teamIds: string[] };

export type FieldGroupAccess = 'view' | 'edit' | 'none';

type FieldGroupAccessContext = Pick<
  WorkspaceAuthorizationContext,
  | 'teamRolesByTeam'
  | 'globalPermissions'
  | 'workspaceCapabilityCeiling'
  | 'workspaceRole'
  | 'workspaceRoles'
>;

/**
 * Global admins, and workspace roles holding the `people.role` capability (the
 * built-in owner/admin roles, or a custom role granted it), always have full
 * access to every field group regardless of team membership — the same "admin
 * sees everything" expectation as the rest of the permission model.
 */
const hasFieldGroupAdminBypass = (context: FieldGroupAccessContext): boolean => {
  if (context.workspaceCapabilityCeiling) {
    return context.workspaceCapabilityCeiling.has('people.role');
  }
  if (context.globalPermissions.has('admin_platform')) return true;
  if (context.workspaceRole == null) return false;
  return (
    context.workspaceRoles.get(context.workspaceRole)?.capabilities.includes('people.role') ?? false
  );
};

/**
 * Evaluates a caller's access to a field group given its optional team-scoped
 * access control. A group with no accessControl (or an empty teamIds list) is
 * unrestricted, matching today's behavior. Otherwise, access is the best
 * access granted across all listed teams (OR semantics): team_editor/team_admin
 * grants edit, team_reviewer grants view. Workspace admins (and global admins)
 * always get 'edit', bypassing team membership entirely.
 */
export const getFieldGroupAccess = (
  context: FieldGroupAccessContext,
  accessControl: FieldGroupAccessControl | undefined
): FieldGroupAccess => {
  if (!accessControl || accessControl.teamIds.length === 0) return 'edit';
  if (hasFieldGroupAdminBypass(context)) return 'edit';

  let best: FieldGroupAccess = 'none';
  for (const teamId of accessControl.teamIds) {
    const roles = context.teamRolesByTeam.get(teamId);
    if (!roles) continue;
    if (roles.has('team_admin') || roles.has('team_editor')) return 'edit';
    if (roles.has('team_reviewer')) best = 'view';
  }
  return best;
};
