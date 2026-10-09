import {
  type AccessibleApplications,
  type ApplicationAccessConfiguration,
  type ApplicationAccessPolicyInput,
  type WorkspaceApplicationId,
  type WorkspaceMemberInfo
} from '@arch-register/api-types/workspaceConfigContract';
import {
  PermissionChecker,
  type ApplicationAccessPolicy as PermissionApplicationAccessPolicy,
  type WorkspaceAuthorizationContext
} from '@arch-register/permissions';
import type { DatabaseAdapter } from '../../db/database';
import type { AuthenticatedEvent } from '../../middleware/auth';
import { runAuthorizedOperation } from '../operation';
import { requireWorkspaceAdmin, requireWorkspaceCapability } from '../auth/authorization';
import { httpAssert } from '../../utils/httpAssert';
import type {
  WorkspaceApplicationAccessPolicyDbResult,
  WorkspaceApplicationAccessPolicyDbCreate
} from './db/workspaceDatabase';

const checker = new PermissionChecker();

const HOME_APPLICATION_ID = 'home';

const requireInstalledApplication = async (
  db: DatabaseAdapter,
  workspace: string,
  applicationId: string
): Promise<string> => {
  const installed = await listInstalledApplicationIds(db, workspace);
  httpAssert.true(installed.includes(applicationId), {
    status: 400,
    message: `Unknown workspace application '${applicationId}'`
  });
  return applicationId;
};

const toPermissionPolicy = (
  policy: WorkspaceApplicationAccessPolicyDbResult | null
): PermissionApplicationAccessPolicy | null =>
  policy == null
    ? null
    : {
        mode: policy.mode,
        userIds: policy.user_ids,
        teamIds: policy.team_ids
      };

const toPolicyOutput = (policy: WorkspaceApplicationAccessPolicyDbResult) => ({
  application_id: policy.application_id,
  mode: policy.mode,
  user_ids: policy.user_ids,
  team_ids: policy.team_ids,
  created_at: policy.created_at.toISOString(),
  updated_at: policy.updated_at.toISOString()
});

const toTeamOutput = (team: {
  id: string;
  workspace: string;
  name: string;
  sort_order: number;
  color: string | null;
  description: string;
  created_at: Date;
}) => ({
  ...team,
  created_at: team.created_at.toISOString()
});

const runApplicationAccessOperation = <Result>(
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent,
  operation: (ws: string, authCtx: WorkspaceAuthorizationContext) => Promise<Result>
) =>
  runAuthorizedOperation({
    db,
    event,
    scope: { kind: 'workspace', workspace },
    operation: ({ ws, authCtx }) => operation(ws, authCtx)
  });

const listInstalledApplicationIds = async (
  db: DatabaseAdapter,
  workspace: string
): Promise<WorkspaceApplicationId[]> => [
  HOME_APPLICATION_ID,
  ...(await db.application.list(workspace)).map(application => application.key)
];

const hasApplicationAccessAdmin = (authCtx: WorkspaceAuthorizationContext) =>
  checker.hasApplicationAccessAdmin(authCtx);

export const listAccessibleApplications = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<AccessibleApplications> =>
  runApplicationAccessOperation(db, workspace, event, async (ws, authCtx) => {
    if (!hasApplicationAccessAdmin(authCtx)) {
      requireWorkspaceCapability(authCtx, 'ws.view');
    }

    const installedApplicationIds = await listInstalledApplicationIds(db, ws);
    const policies = await db.workspace.listWorkspaceApplicationAccessPolicies(ws);
    const policiesByApplication = new Map(
      policies.map(policy => [policy.application_id, toPermissionPolicy(policy)])
    );
    const accessibleApplicationIds = installedApplicationIds.filter(
      applicationId =>
        applicationId === HOME_APPLICATION_ID ||
        checker.hasApplicationAccess(authCtx, policiesByApplication.get(applicationId) ?? null)
    );

    return {
      installed_application_ids: installedApplicationIds,
      accessible_application_ids: accessibleApplicationIds
    };
  });

const toMemberInfo = (
  member: { workspace: string; user_id: string; role: string; created_at: Date },
  user: { display_name: string; email: string | null } | undefined
): WorkspaceMemberInfo => ({
  workspace: member.workspace,
  user_id: member.user_id,
  role: member.role,
  display_name: user?.display_name ?? member.user_id,
  email: user?.email ?? null,
  created_at: member.created_at.toISOString()
});

export const listApplicationAccessConfiguration = async (
  db: DatabaseAdapter,
  workspace: string,
  event: AuthenticatedEvent
): Promise<ApplicationAccessConfiguration> =>
  runApplicationAccessOperation(db, workspace, event, async (ws, authCtx) => {
    requireWorkspaceAdmin(authCtx);
    const [policies, members, teams, users] = await Promise.all([
      db.workspace.listWorkspaceApplicationAccessPolicies(ws),
      db.workspace.listWorkspaceMembers(ws),
      db.workspace.listTeams(ws),
      db.auth.listUsers()
    ]);
    const usersById = new Map(users.map(user => [user.id, user]));

    return {
      policies: policies.map(toPolicyOutput),
      members: members.map(member => toMemberInfo(member, usersById.get(member.user_id))),
      teams: teams.map(toTeamOutput)
    };
  });

export const updateApplicationAccessPolicy = async (
  db: DatabaseAdapter,
  workspace: string,
  applicationId: string,
  input: ApplicationAccessPolicyInput,
  event: AuthenticatedEvent
) =>
  runApplicationAccessOperation(db, workspace, event, async (ws, authCtx) => {
    requireWorkspaceAdmin(authCtx);
    await requireInstalledApplication(db, ws, applicationId);
    httpAssert.true(applicationId !== HOME_APPLICATION_ID, {
      status: 400,
      message: 'Home is always available and does not have an access policy'
    });

    const userIds =
      input.mode === 'selected'
        ? [...new Set(input.user_ids.map(value => value.trim()).filter(Boolean))]
        : [];
    const teamIds =
      input.mode === 'selected'
        ? [...new Set(input.team_ids.map(value => value.trim()).filter(Boolean))]
        : [];

    const [members, teams] = await Promise.all([
      db.workspace.listWorkspaceMembers(ws),
      db.workspace.listTeams(ws)
    ]);
    const memberIds = new Set(members.map(member => member.user_id));
    const teamIdsInWorkspace = new Set(teams.map(team => team.id));

    httpAssert.true(
      userIds.every(userId => memberIds.has(userId)),
      {
        status: 400,
        message: 'user_ids must reference workspace members'
      }
    );
    httpAssert.true(
      teamIds.every(teamId => teamIdsInWorkspace.has(teamId)),
      {
        status: 400,
        message: 'team_ids must reference teams in this workspace'
      }
    );

    const now = new Date();
    const row: WorkspaceApplicationAccessPolicyDbCreate = {
      workspace: ws,
      application_id: applicationId,
      mode: input.mode,
      user_ids: userIds,
      team_ids: teamIds,
      created_at: now,
      updated_at: now
    };
    return toPolicyOutput(await db.workspace.upsertWorkspaceApplicationAccessPolicy(row));
  });

export const resetApplicationAccessPolicy = async (
  db: DatabaseAdapter,
  workspace: string,
  applicationId: string,
  event: AuthenticatedEvent
) =>
  runApplicationAccessOperation(db, workspace, event, async (ws, authCtx) => {
    requireWorkspaceAdmin(authCtx);
    await requireInstalledApplication(db, ws, applicationId);
    httpAssert.true(applicationId !== HOME_APPLICATION_ID, {
      status: 400,
      message: 'Home is always available and does not have an access policy'
    });
    const deleted = await db.workspace.deleteWorkspaceApplicationAccessPolicy(ws, applicationId);
    return deleted ? toPolicyOutput(deleted) : null;
  });
