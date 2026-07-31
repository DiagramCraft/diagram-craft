import type { WorkspaceAuthorizationContext } from './types.js';

export type FieldGroupAccessControl = { teamIds: string[] };

export type FieldGroupAccess = 'view' | 'edit' | 'none';

/**
 * Evaluates a caller's access to a field group given its optional team-scoped
 * access control. A group with no accessControl (or an empty teamIds list) is
 * unrestricted, matching today's behavior. Otherwise, access is the best
 * access granted across all listed teams (OR semantics): team_editor/team_admin
 * grants edit, team_reviewer grants view.
 */
export const getFieldGroupAccess = (
  context: Pick<WorkspaceAuthorizationContext, 'teamRolesByTeam'>,
  accessControl: FieldGroupAccessControl | undefined
): FieldGroupAccess => {
  if (!accessControl || accessControl.teamIds.length === 0) return 'edit';

  let best: FieldGroupAccess = 'none';
  for (const teamId of accessControl.teamIds) {
    const roles = context.teamRolesByTeam.get(teamId);
    if (!roles) continue;
    if (roles.has('team_admin') || roles.has('team_editor')) return 'edit';
    if (roles.has('team_reviewer')) best = 'view';
  }
  return best;
};
