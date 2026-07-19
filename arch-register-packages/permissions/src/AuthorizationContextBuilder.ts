import type {
  AuthorizationContext,
  Entity,
  EntityGrant,
  EntitySchema,
  GlobalRole,
  TeamAssignment,
  WorkspaceAuthorizationContext,
  WorkspaceTeam,
  WorkspaceRole,
  WorkspaceRoleDefinition,
  WorkspaceCapability
} from './types.js';
import { getGlobalPermissionsForRoles, resolveWorkspaceRoleDefinitions } from './constants.js';

/**
 * Data provider interface for fetching permission-related data.
 * Implementations provide data from different sources (database, API, etc.)
 */
export interface PermissionDataProvider {
  /**
   * Fetch all entities in workspace (for relationship traversal)
   */
  getEntities(workspaceId: string): Promise<Entity[]>;

  /**
   * Fetch all schemas (for field definitions)
   */
  getSchemas(workspaceId: string): Promise<EntitySchema[]>;

  /**
   * Fetch entity grants for permission evaluation
   */
  getEntityGrants(workspaceId: string): Promise<EntityGrant[]>;

  /**
   * Fetch user's team assignments
   */
  getTeamAssignments(workspaceId: string, userId: string): Promise<TeamAssignment[]>;

  /**
   * Fetch user's global role assignments
   */
  getGlobalRoles(userId: string): Promise<GlobalRole[]>;

  /**
   * Fetch workspace owner options (teams that can own records)
   */
  getTeams(workspaceId: string): Promise<WorkspaceTeam[]>;

  /**
   * Fetch user's workspace role
   */
  getWorkspaceRole(workspaceId: string, userId: string): Promise<WorkspaceRole | null>;

  /**
   * Fetch available workspace roles
   */
  getWorkspaceRoles?(workspaceId: string): Promise<WorkspaceRoleDefinition[]>;
}

export type WorkspaceAuthorizationContextData = {
  userId: string;
  globalRoles: GlobalRole[];
  workspaceRole: WorkspaceRole | null;
  workspaceRoles?: WorkspaceRoleDefinition[];
  teamAssignments?: TeamAssignment[];
  teams?: WorkspaceTeam[];
  workspaceCapabilityCeiling?: WorkspaceCapability[];
};

export type EntityAuthorizationContextData = {
  schemas: EntitySchema[];
  entities: Entity[];
  grants: EntityGrant[];
};

export type AuthorizationContextData = WorkspaceAuthorizationContextData &
  EntityAuthorizationContextData;

export const buildWorkspaceAuthorizationContext = ({
  userId,
  globalRoles,
  workspaceRole,
  workspaceRoles,
  teamAssignments,
  teams,
  workspaceCapabilityCeiling
}: WorkspaceAuthorizationContextData): WorkspaceAuthorizationContext => {
  const normalizedTeams = teams ?? [];
  const normalizedWorkspaceRoles = resolveWorkspaceRoleDefinitions(workspaceRoles ?? []);
  const globalRolesSet = new Set(globalRoles);
  const globalPermissions = getGlobalPermissionsForRoles(globalRolesSet);
  const normalizedAssignments = teamAssignments ?? [];
  const teamRolesByTeam = new Map<string, Set<TeamAssignment['role']>>();
  for (const assignment of normalizedAssignments) {
    const roles = teamRolesByTeam.get(assignment.teamId) ?? new Set<TeamAssignment['role']>();
    roles.add(assignment.role);
    teamRolesByTeam.set(assignment.teamId, roles);
  }

  return {
    userId,
    globalRoles: globalRolesSet,
    globalPermissions,
    workspaceRole: workspaceRole ?? null,
    workspaceRoles: new Map(normalizedWorkspaceRoles.map(role => [role.id, role])),
    teamIds: new Set(normalizedAssignments.map(assignment => assignment.teamId)),
    teamAssignments: normalizedAssignments,
    teamRolesByTeam,
    teams: normalizedTeams,
    ...(workspaceCapabilityCeiling
      ? { workspaceCapabilityCeiling: new Set(workspaceCapabilityCeiling) }
      : {})
  };
};

export const buildAuthorizationContext = ({
  schemas,
  entities,
  grants,
  ...workspaceData
}: AuthorizationContextData): AuthorizationContext => {
  return {
    ...buildWorkspaceAuthorizationContext(workspaceData),
    schemas: new Map(schemas.map(schema => [schema.id, schema])),
    entities: new Map(entities.map(entity => [entity.id, entity])),
    grants
  };
};

export const buildEntityAuthorizationContext = (
  workspaceContext: WorkspaceAuthorizationContext,
  { schemas, entities, grants }: EntityAuthorizationContextData
): AuthorizationContext => ({
  ...workspaceContext,
  schemas: new Map(schemas.map(schema => [schema.id, schema])),
  entities: new Map(entities.map(entity => [entity.id, entity])),
  grants
});

export const fetchWorkspaceAuthorizationContextData = async (
  dataProvider: PermissionDataProvider,
  workspaceId: string,
  userId: string
): Promise<WorkspaceAuthorizationContextData> => {
  const [globalRoles, workspaceRole, workspaceRoles, teamAssignments, teams] = await Promise.all([
    dataProvider.getGlobalRoles(userId),
    dataProvider.getWorkspaceRole(workspaceId, userId),
    dataProvider.getWorkspaceRoles?.(workspaceId) ?? Promise.resolve([]),
    dataProvider.getTeamAssignments(workspaceId, userId),
    dataProvider.getTeams(workspaceId)
  ]);

  return {
    userId,
    globalRoles,
    workspaceRole,
    workspaceRoles,
    teamAssignments,
    teams
  };
};

export const fetchEntityAuthorizationContextData = async (
  dataProvider: PermissionDataProvider,
  workspaceId: string
): Promise<EntityAuthorizationContextData> => {
  const [schemas, entities, grants] = await Promise.all([
    dataProvider.getSchemas(workspaceId),
    dataProvider.getEntities(workspaceId),
    dataProvider.getEntityGrants(workspaceId)
  ]);

  return { schemas, entities, grants };
};

export const fetchAuthorizationContextData = async (
  dataProvider: PermissionDataProvider,
  workspaceId: string,
  userId: string
): Promise<AuthorizationContextData> => {
  const [workspaceData, entityData] = await Promise.all([
    fetchWorkspaceAuthorizationContextData(dataProvider, workspaceId, userId),
    fetchEntityAuthorizationContextData(dataProvider, workspaceId)
  ]);

  return { ...workspaceData, ...entityData };
};
