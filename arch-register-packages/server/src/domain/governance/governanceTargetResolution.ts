import type {
  GovernanceApprovalConfig,
  GovernanceEscalationConfig
} from '@arch-register/api-types/governanceCaseConfigSchemas';
import type { DatabaseAdapter } from '../../db/database';
import type { GovernanceAssignmentTarget } from './governanceOperations';

const targetKey = (target: GovernanceAssignmentTarget) => JSON.stringify(target);

const uniqueTargets = (targets: GovernanceAssignmentTarget[]) => {
  const seen = new Set<string>();
  return targets.filter(target => {
    const key = targetKey(target);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

const activeUsersAndTeams = async (db: DatabaseAdapter, workspace: string) => {
  const [users, teams, memberships] = await Promise.all([
    db.auth.listUsers(),
    db.workspace.listTeams(workspace),
    db.workspace.listTeamAssignments(workspace)
  ]);
  return {
    activeUserIds: new Set(users.filter(user => user.is_active).map(user => user.id)),
    teamIds: new Set(teams.map(team => team.id)),
    memberships
  };
};

const targetHasEligibleUsers = async (
  target: GovernanceAssignmentTarget,
  context: Awaited<ReturnType<typeof activeUsersAndTeams>>
) => {
  if (target.type === 'user') return context.activeUserIds.has(target.userId);
  if (target.type === 'capability') return true;
  if (!context.teamIds.has(target.teamId)) return false;
  return context.memberships.some(
    membership =>
      membership.team_id === target.teamId &&
      context.activeUserIds.has(membership.user_id) &&
      (target.type === 'team' || membership.role === target.teamRole)
  );
};

export const filterValidGovernanceTargets = async (
  db: DatabaseAdapter,
  workspace: string,
  targets: GovernanceAssignmentTarget[]
) => {
  const unique = uniqueTargets(targets);
  if (unique.every(target => target.type === 'capability')) return unique;
  const context = await activeUsersAndTeams(db, workspace);
  const valid = [] as GovernanceAssignmentTarget[];
  for (const target of unique) {
    if (await targetHasEligibleUsers(target, context)) valid.push(target);
  }
  return valid;
};

export const configuredFallbackTargets = async (
  db: DatabaseAdapter,
  workspace: string,
  config: GovernanceApprovalConfig | GovernanceEscalationConfig
) => {
  const context = await activeUsersAndTeams(db, workspace);
  const targets: GovernanceAssignmentTarget[] = [
    ...config.fallbackUserIds.map(userId => ({ type: 'user' as const, userId })),
    ...config.fallbackTeamIds.map(teamId => ({ type: 'team' as const, teamId }))
  ];
  return filterValidGovernanceTargetsWithContext(targets, context);
};

const filterValidGovernanceTargetsWithContext = async (
  targets: GovernanceAssignmentTarget[],
  context: Awaited<ReturnType<typeof activeUsersAndTeams>>
) => {
  const valid = [] as GovernanceAssignmentTarget[];
  for (const target of uniqueTargets(targets)) {
    if (await targetHasEligibleUsers(target, context)) valid.push(target);
  }
  return valid;
};

export const eligibleUserIdsForGovernanceTargets = async (
  db: DatabaseAdapter,
  workspace: string,
  targets: GovernanceAssignmentTarget[]
) => {
  const context = await activeUsersAndTeams(db, workspace);
  const userIds = new Set<string>();
  for (const target of uniqueTargets(targets)) {
    if (target.type === 'user') {
      if (context.activeUserIds.has(target.userId)) userIds.add(target.userId);
      continue;
    }
    if (target.type === 'capability') continue;
    for (const membership of context.memberships) {
      if (
        membership.team_id === target.teamId &&
        context.activeUserIds.has(membership.user_id) &&
        (target.type === 'team' || membership.role === target.teamRole)
      ) {
        userIds.add(membership.user_id);
      }
    }
  }
  return userIds;
};

export const workspaceAdminApprovalTargets = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<GovernanceAssignmentTarget[]> => {
  const [members, users] = await Promise.all([
    db.workspace.listWorkspaceMembers(workspace),
    db.auth.listUsers()
  ]);
  const activeUserIds = new Set(users.filter(user => user.is_active).map(user => user.id));
  return uniqueTargets(
    members
      .filter(
        member =>
          (member.role === 'owner' || member.role === 'admin') && activeUserIds.has(member.user_id)
      )
      .map(member => ({ type: 'user' as const, userId: member.user_id }))
  );
};

export const workspaceAdminEscalationTarget = (): GovernanceAssignmentTarget => ({
  type: 'capability',
  capability: 'ws.settings'
});

export const resolveApprovalTargets = async (
  db: DatabaseAdapter,
  workspace: string,
  strategyTargets: GovernanceAssignmentTarget[],
  config: GovernanceApprovalConfig,
  requiredApprovals: number
) => {
  const validStrategyTargets = await filterValidGovernanceTargets(db, workspace, strategyTargets);
  if (validStrategyTargets.length >= requiredApprovals) return validStrategyTargets;

  const fallbackTargets = await configuredFallbackTargets(db, workspace, config);
  const combined = uniqueTargets([...validStrategyTargets, ...fallbackTargets]);
  if (combined.length >= requiredApprovals) return combined;

  return uniqueTargets([...combined, ...(await workspaceAdminApprovalTargets(db, workspace))]);
};

export const resolveEscalationTargets = async (
  db: DatabaseAdapter,
  workspace: string,
  strategyTargets: GovernanceAssignmentTarget[],
  config: GovernanceEscalationConfig
) => {
  const validStrategyTargets = await filterValidGovernanceTargets(db, workspace, strategyTargets);
  if (validStrategyTargets.length > 0) return validStrategyTargets;
  const fallbackTargets = await configuredFallbackTargets(db, workspace, config);
  if (fallbackTargets.length > 0) return fallbackTargets;
  return [workspaceAdminEscalationTarget()];
};
