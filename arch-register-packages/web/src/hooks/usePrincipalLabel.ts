import { useMemo } from 'react';
import { useWorkspaceContext } from '../layouts/WorkspaceContext';
import { useWorkspaceMembers } from './useWorkspaceMembers';
import { useTeams } from './useWorkspaceConfig';

export type PrincipalValue = { principal_type?: string; principal_id?: string } | null | undefined;

/**
 * Resolves a `principal` field value (`{ principal_type: 'user' | 'team', principal_id }`) to its
 * display name, using the same member/team lists `WorkflowFallbackTargetPicker` resolves ids
 * against. Falls back to the raw id when the member/team can't be found (e.g. still loading, or
 * removed from the workspace), so callers never show a blank label.
 */
export const usePrincipalLabel = () => {
  const { workspaceSlug } = useWorkspaceContext();
  const { data: members = [] } = useWorkspaceMembers(workspaceSlug);
  const { data: teams = [] } = useTeams(workspaceSlug);

  const memberLabels = useMemo(
    () => new Map(members.map(member => [member.user_id, member.display_name])),
    [members]
  );
  const teamLabels = useMemo(() => new Map(teams.map(team => [team.id, team.name])), [teams]);

  return (principal: PrincipalValue): string | undefined => {
    if (!principal?.principal_id) return undefined;
    const label =
      principal.principal_type === 'team'
        ? teamLabels.get(principal.principal_id)
        : memberLabels.get(principal.principal_id);
    return label ?? principal.principal_id;
  };
};
